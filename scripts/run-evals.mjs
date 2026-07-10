import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateEvalCases } from "./lib/eval-cases.mjs";
import { evaluateProfile, evaluatePrompt } from "./lib/prompt-contract.mjs";
import { startWorkbenchClient } from "./lib/workbench-client.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseOptions(process.argv.slice(2));
const allCases = JSON.parse(await readFile(path.join(ROOT, "evals", "cases.json"), "utf8"));
const caseValidation = validateEvalCases(allCases);

if (!caseValidation.pass) {
  console.error(`Eval case validation failed:\n- ${caseValidation.errors.join("\n- ")}`);
  process.exit(1);
}

let cases = options.caseId ? allCases.filter((item) => item.id === options.caseId) : allCases;
if (options.caseId && !cases.length) {
  console.error(`Unknown eval case: ${options.caseId}`);
  process.exit(1);
}
if (options.limit) cases = cases.slice(0, options.limit);

if (options.dryRun) {
  console.log(`Eval cases valid: ${JSON.stringify(caseValidation.summary)}`);
  console.log(`Selected cases: ${cases.map((item) => item.id).join(", ")}`);
  process.exit(0);
}

if (options.recheckPath) {
  const previous = JSON.parse(await readFile(options.recheckPath, "utf8"));
  const casesById = new Map(allCases.map((item) => [item.id, item]));
  const results = previous.results.map((result) => {
    const item = casesById.get(result.id);
    if (!item || !result.profile || !result.prompt) return result;
    const profileReport = evaluateProfile(result.profile);
    const promptReport = evaluatePrompt(result.prompt, item);
    return { ...result, pass: profileReport.pass && promptReport.pass, profileReport, promptReport };
  });
  const summary = summarize(results, previous.summary?.model || "unknown");
  const reportPaths = await writeReports(results, { ...summary, recheckedFrom: path.relative(ROOT, options.recheckPath) }, options.outputDir);
  console.log(
    `Eval recheck complete: hardPass=${summary.passed}/${summary.total}, hardPassRate=${percent(summary.hardPassRate)}, ` +
    `observableCoverage=${percent(summary.observableCoverage)}, p50Ms=${summary.p50Ms}, p95Ms=${summary.p95Ms}`
  );
  console.log(`Reports: ${reportPaths.json}, ${reportPaths.markdown}`);
  if (summary.passed !== summary.total) process.exitCode = 1;
  process.exit();
}

const client = await startWorkbenchClient();
try {
  const status = await client.requestJson("/api/status");
  if (!status.aiConfigured) {
    throw new Error("AI is not configured. Set OPENAI_API_KEY or AIGC_API_KEY before running evals.");
  }

  console.log(`Performance eval: model=${status.model}, cases=${cases.length}`);
  const results = [];
  for (const [index, item] of cases.entries()) {
    const startedAt = performance.now();
    try {
      const profilePayload = await client.requestJson("/api/generate-profile", {
        method: "POST",
        body: { script: item.script, market: item.market, tuning: [] }
      });
      const profileReport = evaluateProfile(profilePayload.profile);
      const promptPayload = await client.requestJson("/api/generate-prompt", {
        method: "POST",
        body: {
          script: item.script,
          selectedText: item.selectedText,
          profile: profilePayload.profile,
          market: item.market,
          sceneType: item.sceneType,
          duration: item.duration,
          tuning: []
        }
      });
      const promptReport = evaluatePrompt(promptPayload.prompt, item);
      const durationMs = Math.round(performance.now() - startedAt);
      const pass = profileReport.pass && promptReport.pass;
      results.push({
        id: item.id,
        title: item.title,
        market: item.market,
        duration: item.duration,
        expectsSplit: item.expectsSplit,
        pass,
        durationMs,
        profileReport,
        promptReport,
        profile: profilePayload.profile,
        prompt: promptPayload.prompt
      });
      console.log(`[${index + 1}/${cases.length}] ${item.id}: ${pass ? "PASS" : "FAIL"} ${durationMs}ms`);
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      results.push({ id: item.id, title: item.title, market: item.market, pass: false, durationMs, error: sanitizeError(error?.message || error) });
      console.log(`[${index + 1}/${cases.length}] ${item.id}: ERROR ${durationMs}ms`);
    }
  }

  const summary = summarize(results, status.model);
  const reportPaths = await writeReports(results, summary, options.outputDir);
  console.log(
    `Eval complete: hardPass=${summary.passed}/${summary.total}, hardPassRate=${percent(summary.hardPassRate)}, ` +
    `observableCoverage=${percent(summary.observableCoverage)}, p50Ms=${summary.p50Ms}, p95Ms=${summary.p95Ms}`
  );
  console.log(`Reports: ${reportPaths.json}, ${reportPaths.markdown}`);
  if (summary.passed !== summary.total) process.exitCode = 1;
} catch (error) {
  console.error(`Performance eval failed: ${sanitizeError(error?.message || error)}`);
  process.exitCode = 1;
} finally {
  await client.close();
}

function parseOptions(args) {
  const getValue = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const limit = Number(getValue("--limit") || 0);
  if (limit && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit must be a positive integer");
  return {
    dryRun: args.includes("--dry-run"),
    caseId: getValue("--case") || "",
    limit,
    recheckPath: getValue("--recheck") ? path.resolve(ROOT, getValue("--recheck")) : "",
    outputDir: getValue("--output-dir") || path.join(ROOT, "evals", "results")
  };
}

function summarize(results, model) {
  const promptReports = results.map((item) => item.promptReport).filter(Boolean);
  const durations = results.map((item) => item.durationMs).filter(Number.isFinite);
  const observableShots = promptReports.reduce((sum, report) => sum + report.metrics.observableShots, 0);
  const shots = promptReports.reduce((sum, report) => sum + report.metrics.shots, 0);
  const passed = results.filter((item) => item.pass).length;
  return {
    generatedAt: new Date().toISOString(),
    model,
    total: results.length,
    passed,
    failed: results.length - passed,
    hardPassRate: results.length ? passed / results.length : 0,
    observableCoverage: shots ? observableShots / shots : 0,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95)
  };
}

async function writeReports(results, summary, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const stamp = summary.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `${stamp}.json`);
  const markdownPath = path.join(outputDir, `${stamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, buildMarkdown(results, summary), "utf8");
  return { json: path.relative(ROOT, jsonPath), markdown: path.relative(ROOT, markdownPath) };
}

function buildMarkdown(results, summary) {
  const rows = results.map((item) =>
    `| ${item.id} | ${item.market} | ${item.pass ? "PASS" : "FAIL"} | ${item.durationMs} | ${item.promptReport?.failedChecks.join(", ") || item.error || "-"} |`
  );
  const details = results.map((item) => `## ${item.title} (${item.id})

- 机器结果：${item.pass ? "PASS" : "FAIL"}
- 人物一致性：待评分 / 5
- 情绪节拍：待评分 / 5
- 动作可执行性：待评分 / 5
- 对白自然度：待评分 / 5
- 首稿可用性：待评分 / 5
- 采用判断：待填写
- 修改字符数：待填写
- 修改比例：待填写

### 模型输出

\`\`\`text
${String(item.prompt || item.error || "无输出").replace(/```/g, "''' ")}
\`\`\`
`).join("\n");

  return `# Performance Prompt Eval Report

- 生成时间：${summary.generatedAt}
- 模型：${summary.model}
- 机器通过：${summary.passed}/${summary.total} (${percent(summary.hardPassRate)})
- 可观测镜头覆盖：${percent(summary.observableCoverage)}
- 延迟：P50 ${summary.p50Ms}ms / P95 ${summary.p95Ms}ms

| 用例 | 市场 | 机器结果 | 耗时(ms) | 失败项 |
|---|---|---:|---:|---|
${rows.join("\n")}

${details}`;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function sanitizeError(value) {
  return String(value).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}
