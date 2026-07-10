import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertContract, evaluateProfile, evaluatePrompt } from "./lib/prompt-contract.mjs";
import { startWorkbenchClient } from "./lib/workbench-client.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runs = readRunCount(process.argv.slice(2), process.env.SMOKE_RUNS);
const script = await readFile(path.join(ROOT, "examples", "example-billionaire-reveal.md"), "utf8");
const selectedText = extractTargetScene(script);
const client = await startWorkbenchClient();

try {
  const status = await client.requestJson("/api/status");
  if (!status.aiConfigured) {
    throw new Error("AI is not configured. Set OPENAI_API_KEY or AIGC_API_KEY before running the smoke test.");
  }

  console.log(`AI smoke: model=${status.model}, runs=${runs}`);
  const durations = [];
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now();
    const profilePayload = await client.requestJson("/api/generate-profile", {
      method: "POST",
      body: { script, market: "overseas", tuning: [] }
    });
    const profileReport = evaluateProfile(profilePayload.profile);
    assertContract(profileReport, "profile");

    const promptPayload = await client.requestJson("/api/generate-prompt", {
      method: "POST",
      body: {
        script,
        selectedText,
        profile: profilePayload.profile,
        market: "overseas",
        sceneType: "reveal",
        duration: 12,
        tuning: []
      }
    });
    const promptReport = evaluatePrompt(promptPayload.prompt, {
      market: "overseas",
      duration: 12,
      expectsDialogue: true,
      expectsSplit: false
    });
    assertContract(promptReport, "prompt");

    const elapsedMs = Math.round(performance.now() - startedAt);
    durations.push(elapsedMs);
    console.log(
      `run=${index + 1} pass=true durationMs=${elapsedMs} profileChars=${profileReport.metrics.chars} ` +
      `promptChars=${promptReport.metrics.chars} shots=${promptReport.metrics.shots}`
    );
  }

  console.log(`AI smoke complete: success=${runs}/${runs}, p50Ms=${percentile(durations, 0.5)}, p95Ms=${percentile(durations, 0.95)}`);
} catch (error) {
  console.error(`AI smoke failed: ${sanitizeError(error?.message || error)}`);
  process.exitCode = 1;
} finally {
  await client.close();
}

function extractTargetScene(value) {
  const match = value.match(/\*\*场景\*\*[：:]\s*([\s\S]*?)(?=\n\n---)/);
  return (match?.[1] || value.slice(0, 1600)).trim();
}

function readRunCount(args, environmentValue) {
  const cliValue = args.find((arg) => arg.startsWith("--runs="))?.split("=")[1];
  const value = Number(cliValue || environmentValue || 1);
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error("SMOKE_RUNS/--runs must be an integer from 1 to 20.");
  }
  return value;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function sanitizeError(value) {
  return String(value).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}
