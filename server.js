const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const zlib = require("node:zlib");

loadDotEnv();

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4174);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const PROJECTS_DIR = path.join(ROOT, "data", "projects");
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.AIGC_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.AIGC_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.AIGC_MODEL || "gpt-4.1";
const MODEL_OPTIONS = buildModelOptions();
const ALLOW_MODEL_CONFIG = envFlag("ALLOW_MODEL_CONFIG");
const ALLOW_CLIENT_BASE_URL = envFlag("ALLOW_CLIENT_BASE_URL");
const ALLOW_CLIENT_API_KEY = envFlag("ALLOW_CLIENT_API_KEY");
const APP_USER = process.env.APP_USER || process.env.BASIC_AUTH_USER || "team";
const APP_PASSWORD = process.env.APP_PASSWORD || process.env.BASIC_AUTH_PASSWORD || "";
const AUTH_ENABLED = envFlag("ENABLE_AUTH") && Boolean(APP_PASSWORD);
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? "null" : "*");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};
const publicAssets = new Set(["/index.html", "/app.js", "/styles.css"]);
const commonSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};
const staticSecurityHeaders = {
  ...commonSecurityHeaders,
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
const apiSecurityHeaders = {
  ...commonSecurityHeaders,
  "cache-control": "no-store",
  "access-control-allow-origin": CORS_ORIGIN,
  "access-control-allow-methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "vary": "Origin"
};

const skillGuide = buildSkillGuide();

function looksLikeJsonishProfileText(text) {
  const value = String(text || "");
  return /```|[\{\}\[\]]|"[^"\n]{1,40}"\s*:|^\s*[\{\[]/m.test(value);
}

function cleanJsonishInlineValue(value) {
  return String(value || "")
    .replace(/^[\s"'`]+|[\s"'`,]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function flattenJsonishValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return cleanJsonishInlineValue(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenJsonishValue(item))
      .filter(Boolean)
      .map((item, index) => `${index + 1}）${item}`)
      .join("；");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => {
        const keyLabel = cleanJsonishInlineValue(key).replace(/[:：]/g, "");
        const flattened = flattenJsonishValue(val);
        return flattened ? `${keyLabel}：${flattened}` : "";
      })
      .filter(Boolean)
      .join("；");
  }
  return "";
}

function parseLooseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeProfileFieldText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[\{\}\[\]]/g, " ")
    .replace(/"([^"]+)"\s*:/g, "$1：")
    .replace(/,\s*/g, "；")
    .replace(/\s{2,}/g, " ")
    .replace(/[；;\s]*$/g, "")
    .trim();
}

function cleanProfileFieldValue(label, rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return "";
  const maybeJson = parseLooseJsonObject(text);
  if (maybeJson && typeof maybeJson === "object") {
    return flattenJsonishValue(maybeJson);
  }
  return normalizeProfileFieldText(text);
}

function sanitizeProfileOutput(rawText) {
  const stripped = stripCodeFence(rawText).replace(/\r/g, "").trim();
  if (!looksLikeJsonishProfileText(stripped)) return stripped;

  const fieldOrder = ["人物ID", "人物小传", "性格底色", "关系动力学", "贯穿情感弧线", "专属表演习惯Tell", "核心情绪微表情库"];

  const normalizedText = stripped
    .replace(/“/g, "\"")
    .replace(/”/g, "\"")
    .replace(/^\s*[-*]\s*/gm, "");

  const maybeTop = parseLooseJsonObject(normalizedText);
  if (maybeTop) {
    const profileObjects = Array.isArray(maybeTop)
      ? maybeTop
      : Array.isArray(maybeTop.characters)
        ? maybeTop.characters
        : Array.isArray(maybeTop.profiles)
          ? maybeTop.profiles
          : typeof maybeTop === "object"
            ? [maybeTop]
            : [];

    const blocks = profileObjects.map((item, index) => {
      const source = item && typeof item === "object" ? item : {};
      const fieldMap = {
        "人物ID": source["人物ID"] || source["人物"] || source["id"] || source["name"] || `人物${index + 1}`,
        "人物小传": source["人物小传"] || source["bio"] || source["简介"] || "",
        "性格底色": source["性格底色"] || source["性格"] || source["底色"] || "",
        "关系动力学": source["关系动力学"] || source["关系"] || source["dynamics"] || "",
        "贯穿情感弧线": source["贯穿情感弧线"] || source["情感弧线"] || source["arc"] || "",
        "专属表演习惯Tell": source["专属表演习惯Tell"] || source["表演习惯Tell"] || source["Tell"] || "",
        "核心情绪微表情库": source["核心情绪微表情库"] || source["微表情库"] || source["expressions"] || ""
      };
      return fieldOrder.map((field) => `${field}：${cleanProfileFieldValue(field, fieldMap[field])}`).join("\n");
    }).filter((block) => /人物ID：/.test(block));

    if (blocks.length) return blocks.join("\n\n---\n\n");
  }

  const matches = [...normalizedText.matchAll(/(^|\n)\s*人物ID\s*[:：]\s*/g)];
  if (!matches.length) {
    return normalizedText
      .replace(/[\{\}\[\]]/g, "")
      .replace(/"([^"]+)"\s*:/g, "$1：")
      .replace(/,\s*/g, "；")
      .trim();
  }

  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index + (matches[i][1] ? matches[i][1].length : 0);
    const end = i + 1 < matches.length ? matches[i + 1].index : normalizedText.length;
    const block = normalizedText.slice(start, end).trim();
    const lines = [];
    for (const field of fieldOrder) {
      const fieldMatch = block.match(new RegExp(`${field}\\s*[:：]\\s*([\\s\\S]*?)(?=\\n(?:人物ID|人物小传|性格底色|关系动力学|贯穿情感弧线|专属表演习惯Tell|核心情绪微表情库)\\s*[:：]|$)`));
      const value = fieldMatch ? cleanProfileFieldValue(field, fieldMatch[1]) : "";
      lines.push(`${field}：${value}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n---\n\n").trim();
}

const requestListener = async (req, res) => {
  try {
    const pathname = getPathname(req);

    if (req.method === "OPTIONS") {
      return sendCors(res, 204);
    }

    if ((req.method === "GET" || req.method === "HEAD") && (pathname === "/healthz" || pathname === "/api/healthz")) {
      return sendJson(res, 200, { ok: true });
    }

    if (!isAuthorized(req)) {
      return requestAuth(res);
    }

    if (req.method === "GET" && pathname === "/api/status") {
      return sendJson(res, 200, {
        ok: true,
        aiConfigured: Boolean(OPENAI_API_KEY),
        authEnabled: AUTH_ENABLED,
        model: OPENAI_MODEL,
        baseUrl: maskBaseUrl(OPENAI_BASE_URL),
        modelConfig: {
          allowModelConfig: ALLOW_MODEL_CONFIG,
          allowBaseUrl: ALLOW_CLIENT_BASE_URL,
          allowApiKey: ALLOW_CLIENT_API_KEY,
          model: OPENAI_MODEL,
          modelOptions: MODEL_OPTIONS,
          baseUrl: maskBaseUrl(OPENAI_BASE_URL)
        },
        extractors: await getExtractorStatus()
      });
    }

    if (req.method === "GET" && pathname === "/api/projects") {
      return await handleListProjects(req, res);
    }

    if (req.method === "POST" && pathname === "/api/projects") {
      return await handleCreateProject(req, res);
    }

    if ((req.method === "GET" || req.method === "PUT" || req.method === "DELETE") && /^\/api\/projects\/[a-z0-9-]+$/.test(pathname)) {
      const id = pathname.split("/").pop();
      if (req.method === "GET") return await handleGetProject(req, res, id);
      if (req.method === "PUT") return await handlePutProject(req, res, id);
      if (req.method === "DELETE") return await handleDeleteProject(req, res, id);
    }

    if (req.method === "POST" && pathname === "/api/extract-file") {
      return await handleExtractFile(req, res);
    }

    if (req.method === "POST" && pathname === "/api/generate-profile") {
      return await handleGenerateProfile(req, res);
    }

    if (req.method === "POST" && pathname === "/api/profile-chat") {
      return await handleProfileChat(req, res);
    }

    if (req.method === "POST" && pathname === "/api/generate-prompt") {
      return await handleGeneratePrompt(req, res);
    }

    if (req.method === "POST" && pathname === "/api/tune") {
      return await handleTune(req, res);
    }

    if (req.method === "POST" && pathname === "/api/revise-chat") {
      return await handleReviseChat(req, res);
    }

    if (req.method === "POST" && pathname === "/api/revise-prompt") {
      return await handleRevisePrompt(req, res);
    }

    if (req.method === "POST" && pathname === "/api/revise-prompt") {
      return await handleRevisePrompt(req, res);
    }

    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/api/static")) {
      return await serveStatic(req, res, pathname.slice("/api/static".length) || "/");
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return await serveStatic(req, res);
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
};

const server = http.createServer(requestListener);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    const displayHost = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
    console.log(`Performance Prompter MVP: http://${displayHost}:${PORT}`);
    console.log(OPENAI_API_KEY ? `AI model: ${OPENAI_MODEL}` : "AI model: not configured, local fallback still works");
    console.log(AUTH_ENABLED ? `Access protection: enabled for user "${APP_USER}"` : "Access protection: disabled");
    console.log(ALLOW_MODEL_CONFIG ? `Model options: ${MODEL_OPTIONS.join(", ")}` : "Model selection: locked");
  });
}

module.exports = requestListener;
module.exports.sanitizeProfileOutput = sanitizeProfileOutput;

module.exports.buildShotSchedule = buildShotSchedule;
module.exports.validateProjectId = validateProjectId;
module.exports.extractScriptWindow = extractScriptWindow;

function validateProjectId(id) {
  const value = String(id || "").trim();
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new Error("Invalid project id");
  }
  return value;
}

function extractScriptWindow(script, range = {}, span = 1500) {
  const source = String(script || "");
  const start = Math.max(0, Math.min(source.length, Number(range.start || 0)));
  const end = Math.max(start, Math.min(source.length, Number(range.end || start)));
  return {
    before: source.slice(Math.max(0, start - span), start),
    selected: source.slice(start, end),
    after: source.slice(end, Math.min(source.length, end + span))
  };
}

async function ensureProjectsDir() {
  await fsp.mkdir(PROJECTS_DIR, { recursive: true });
}

function projectFilePath(id) {
  return path.join(PROJECTS_DIR, `${validateProjectId(id)}.json`);
}

function toProjectMeta(project) {
  return {
    id: project.id,
    projectName: project.projectName || "未命名项目",
    market: project.market || "overseas",
    updatedAt: project.state?.updatedAt || project.updatedAt || ""
  };
}

function buildProjectPayloadFromBody(id, body = {}) {
  const nextId = validateProjectId(id || body.id || "");
  return {
    id: nextId,
    projectName: String(body.projectName || "未命名项目").trim() || "未命名项目",
    market: body.market === "domestic" ? "domestic" : "overseas",
    script: String(body.script || ""),
    profile: String(body.profile || ""),
    prompt: String(body.prompt || ""),
    state: {
      ...(body.state && typeof body.state === "object" ? body.state : {}),
      projectId: nextId,
      updatedAt: body.state?.updatedAt || new Date().toISOString()
    }
  };
}

function isReadonlyFsError(error) {
  return /EROFS|EACCES|EPERM|ENOTSUP|read[- ]?only|不可写/i.test(String(error?.message || error?.code || ""));
}

async function handleListProjects(req, res) {
  try {
    await ensureProjectsDir();
    const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await fsp.readFile(path.join(PROJECTS_DIR, entry.name), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed?.id) projects.push(toProjectMeta(parsed));
      } catch {
        // ignore broken files
      }
    }

    projects.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return sendJson(res, 200, { ok: true, projects, writable: true });
  } catch (error) {
    if (isReadonlyFsError(error)) {
      return sendJson(res, 200, { ok: true, projects: [], writable: false });
    }
    throw error;
  }
}

async function handleCreateProject(req, res) {
  const body = await readJson(req);
  const projectName = String(body.projectName || "未命名项目").trim() || "未命名项目";
  const market = body.market === "domestic" ? "domestic" : "overseas";
  const slugBase = projectName
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "project";
  const id = validateProjectId(`${slugBase}-${Date.now().toString(36)}`);
  const project = buildProjectPayloadFromBody(id, { projectName, market, state: { currentStep: "script" } });

  try {
    await ensureProjectsDir();
    await fsp.writeFile(projectFilePath(id), JSON.stringify(project, null, 2), "utf8");
    return sendJson(res, 200, { ok: true, project: toProjectMeta(project), writable: true });
  } catch (error) {
    if (isReadonlyFsError(error)) {
      return sendJson(res, 200, { ok: true, project: toProjectMeta(project), writable: false });
    }
    throw error;
  }
}

async function handleGetProject(req, res, id) {
  const projectId = validateProjectId(id);
  await ensureProjectsDir();
  try {
    const raw = await fsp.readFile(projectFilePath(projectId), "utf8");
    const project = JSON.parse(raw);
    return sendJson(res, 200, { ok: true, project, writable: true });
  } catch (error) {
    if (error?.code === "ENOENT") return sendJson(res, 404, { error: "Project not found" });
    if (isReadonlyFsError(error)) return sendJson(res, 200, { ok: true, project: buildProjectPayloadFromBody(projectId, {}), writable: false });
    throw error;
  }
}

async function handlePutProject(req, res, id) {
  const body = await readJson(req);
  const projectId = validateProjectId(id);
  const project = buildProjectPayloadFromBody(projectId, body);

  try {
    await ensureProjectsDir();
    await fsp.writeFile(projectFilePath(projectId), JSON.stringify(project, null, 2), "utf8");
    return sendJson(res, 200, { ok: true, project, writable: true });
  } catch (error) {
    if (isReadonlyFsError(error)) {
      return sendJson(res, 200, { ok: true, project, writable: false });
    }
    throw error;
  }
}

async function handleDeleteProject(req, res, id) {
  const projectId = validateProjectId(id);
  try {
    await ensureProjectsDir();
    await fsp.rm(projectFilePath(projectId), { force: true });
    return sendJson(res, 200, { ok: true, writable: true });
  } catch (error) {
    if (isReadonlyFsError(error)) {
      return sendJson(res, 200, { ok: true, writable: false });
    }
    throw error;
  }
}

function buildSeedancePromptInstruction(args = {}) {
  const market = args.market === "domestic" ? "domestic" : "overseas";
  const marketLabel = market === "domestic" ? "国内中文对白" : "海外英文对白";
  const selectedText = String(args.selectedText || "").trim();
  const profile = String(args.profile || "").trim();
  const fullScript = String(args.fullScript || "").trim();
  const tuning = String(args.tuning || "无额外调教。").trim();
  const currentPrompt = String(args.currentPrompt || "").trim();
  const extraInstruction = String(args.extraInstruction || "").trim();
  const mode = args.mode === "revise" ? "revise" : "generate";
  const windowed = extractScriptWindow(fullScript, args.selectionRange || {}, 1500);

  return `你要输出一个可直接通过本项目 prompt-contract 校验的 Seedance 2.0 Prompt。

硬性输出契约：
1. 只输出最终 Prompt，不要解释，不要代码围栏。
2. 必须以“@……为场景参考”开头，并包含“根据以下序列分镜生成视频，全程无BGM、无字幕、无画面水印。”
3. 后续必须按以下结构输出若干分镜，编号连续：分镜1、分镜2……
4. 每个分镜内部字段顺序必须严格为：
   镜头语言 → 主体动作状态（整体姿态、头部、眼神/表情、手部、细节）→ 场景环境 → 音效 → 台词 → 时长
5. 每个分镜都必须显式写出“音效：… 台词：… 时长：Xs”。
6. 总时长不得超过15s；分镜时长相加 ≤ 15s。
7. 末尾必须有且仅有以下四段：
   风格：
   约束：
   场景理解：
   设计说明：
8. 所有动作必须可观测，优先微动作：呼吸、停顿、慢眨眼、喉结、视线路径、指节、手腕、肩颈、重心、衣料摩擦、道具接触。
9. 严禁参数词与摄影机技术参数词：8K、24fps、f/2.8、ISO数值、fast、电影感参数、参数词。
10. ${market === "domestic" ? "台词必须为中文或“无”。" : "台词必须为英文或“无”，不得出现中文对白。"}
11. 分镜内容必须紧扣所选剧情，不能泛化成通用模板。
12. 如写到雨、风、雾、光线等环境成因，必须写出对应可观测结果，例如风吹动衣角、光线投下阴影、雨滴打在伞面等。

生成偏好：
- 保持剧情顺序，不跳戏，不新增关键人物。
- 人物一致性以人物档案为准。
- 重点写潜台词如何通过身体泄漏，而不是解释情绪。
- 对白克制，能“无”则不要强塞对白。
- 每个分镜至少覆盖多个可观测信号类别：面部/眼神、呼吸或声音、身体或手部/道具。
- 建议总时长控制在 5s-15s 之间。

目标市场：${marketLabel}

人物档案：
${profile.slice(0, 24000)}

所选剧情：
${selectedText.slice(0, 12000)}

上文：
${windowed.before.slice(-1500)}

下文：
${windowed.after.slice(0, 1500)}

全局调教：
${tuning}

${mode === "revise" ? `当前待改 Prompt：
${currentPrompt.slice(0, 24000)}

改稿要求：
${extraInstruction || "请在保留原剧情核心推进的前提下重写。"}
` : `任务：
请直接生成新的 Prompt，严格满足上述格式与校验约束。
${extraInstruction ? `补充要求：\n${extraInstruction}\n` : ""}`}

再次提醒：
- 参考头必须包含 @参考头
- 分镜必须连续编号
- 每个分镜都要有“音效：”“台词：”“时长：Xs”
- 末尾必须有“风格：”“约束：”“场景理解：”“设计说明：”
- 输出内容必须可被严格文本校验通过。`;
}

async function handleExtractFile(req, res) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return sendJson(res, 400, { error: "Expected multipart/form-data upload" });
  }

  const body = await readBody(req, MAX_UPLOAD_BYTES);
  const parts = parseMultipart(body, boundaryMatch[1] || boundaryMatch[2]);
  const filePart = parts.find((part) => part.filename);
  if (!filePart) {
    return sendJson(res, 400, { error: "No file found in upload" });
  }

  const originalName = safeFilename(filePart.filename);
  const extension = path.extname(originalName).toLowerCase();
  if (![".pdf", ".docx", ".doc", ".txt", ".md"].includes(extension)) {
    return sendJson(res, 400, { error: "Only PDF, DOCX, DOC, TXT and MD files are supported" });
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "performance-prompter-"));
  const filePath = path.join(tmpDir, `${crypto.randomUUID()}${extension}`);
  try {
    await fsp.writeFile(filePath, filePart.data);
    const result = await extractText(filePath, extension);
    sendJson(res, 200, {
      ok: true,
      filename: originalName,
      chars: result.text.length,
      method: result.method,
      warnings: result.warnings,
      text: result.text
    });
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

async function handleGenerateProfile(req, res) {
  const body = await readJson(req);
  const modelConfig = resolveModelConfig(body.modelConfig);
  ensureAiConfigured(modelConfig);
  const script = String(body.script || "").trim();
  if (!script) return sendJson(res, 400, { error: "script is required" });

  const market = body.market === "domestic" ? "国内题材 / 中文对白" : "欧美市场 / 英文对白";
  const tuning = stringifyTuning(body.tuning);
  const content = await callModel([
    { role: "system", content: skillGuide },
    {
      role: "user",
      content: `请基于以下剧本建立“人物表演档案”。目标市场：${market}。

输出要求：
- 只输出可直接粘贴进人设确认框的中文档案，不要寒暄。
- 每个主要人物都要包含：人物ID、人物小传、性格底色、关系动力学、贯穿情感弧线、专属表演习惯Tell、核心情绪微表情库。
- 上述七个字段名必须逐字输出；每个角色必须以“人物ID：角色ID”开头，不得用“人物：”、Markdown 标题或姓名标题代替“人物ID：”。
- 严禁输出 JSON、数组、代码围栏、花括号、方括号、键值对嵌套、冒号对象结构；不要出现 {"对_A": {...}} 这类形式。
- 关系动力学必须写成纯中文可读文本，可用分号、顿号、换行表达，不得使用任何嵌套结构。
- 每个字段都允许多行；“核心情绪微表情库”建议分条写，每条仍用纯中文描述。
- 所有表演描述必须是可观测肌肉、肢体、呼吸、眼神信号。
- 不要写空泛词，例如“高级”“电影感”“很伤心”。

全局调教：
${tuning}

剧本：
${script.slice(0, 60000)}`
    }
  ], { temperature: 0.35, modelConfig });

  sendJson(res, 200, { ok: true, profile: sanitizeProfileOutput(content) });
}

async function handleProfileChat(req, res) {
  const body = await readJson(req);
  const modelConfig = resolveModelConfig(body.modelConfig);
  ensureAiConfigured(modelConfig);

  const script = String(body.script || "").trim();
  const profile = String(body.profile || "").trim();
  const characterId = String(body.characterId || "").trim();
  const characterBlock = String(body.characterBlock || "").trim();
  const instruction = String(body.instruction || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const market = body.market === "domestic" ? "国内题材 / 中文对白" : "欧美市场 / 英文对白";

  if (!profile) return sendJson(res, 400, { error: "profile is required" });
  if (!characterId) return sendJson(res, 400, { error: "characterId is required" });
  if (!characterBlock) return sendJson(res, 400, { error: "characterBlock is required" });
  if (!instruction) return sendJson(res, 400, { error: "instruction is required" });

  const content = await callModel([
    { role: "system", content: skillGuide },
    {
      role: "user",
      content: `你现在只修改单个人物的人设档案块，不能改其他人物。

硬性要求：
- 只输出两部分：
  1）更新后的该人物完整档案块
  2）最后单独一行：改动说明：……
- 更新后的档案块必须完整包含且逐字使用以下七个字段名：
人物ID、人物小传、性格底色、关系动力学、贯穿情感弧线、专属表演习惯Tell、核心情绪微表情库
- 必须以“人物ID：${characterId}”开头。
- 严禁输出 JSON、代码围栏、花括号、方括号、键值对嵌套。
- 所有字段都写成纯中文自然语言；“核心情绪微表情库”也必须保留并填写。
- 改动只作用于该人物，但允许根据全体关系微调其“关系动力学”表述。
- 不要寒暄。

目标市场：${market}

当前全体人物档案：
${profile.slice(0, 26000)}

当前要修改的人物档案块：
${characterBlock.slice(0, 10000)}

最近对话历史：
${JSON.stringify(history).slice(0, 4000)}

本次修改要求：
${instruction}

完整剧本上下文：
${script.slice(0, 30000)}`
    }
  ], { temperature: 0.4, modelConfig });

  const cleaned = sanitizeProfileOutput(content);
  const lines = cleaned.split("\n");
  const noteLineIndex = lines.findIndex((line) => /^改动说明[:：]/.test(line.trim()));
  const updatedBlock = (noteLineIndex >= 0 ? lines.slice(0, noteLineIndex) : lines).join("\n").trim();
  const changeNote = noteLineIndex >= 0 ? lines.slice(noteLineIndex).join("\n").trim() : "改动说明：已按要求更新该人物档案。";

  sendJson(res, 200, {
    ok: true,
    updatedBlock,
    changeNote
  });
}

async function handleGeneratePrompt(req, res) {
  const body = await readJson(req);
  const modelConfig = resolveModelConfig(body.modelConfig);
  ensureAiConfigured(modelConfig);
  const selectedText = String(body.selectedText || "").trim();
  const script = String(body.script || "").trim();
  const profile = String(body.profile || "").trim();
  if (!selectedText) return sendJson(res, 400, { error: "selectedText is required" });
  if (!profile) return sendJson(res, 400, { error: "profile is required" });

  const content = await callModel([
    { role: "system", content: skillGuide },
    {
      role: "user",
      content: buildSeedancePromptInstruction({
        market: body.market,
        profile,
        tuning: stringifyTuning(body.tuning),
        selectedText,
        fullScript: script,
        selectionRange: body.selectionRange || body.sceneSelectionRange || {},
        mode: "generate"
      })
    }
  ], { temperature: 0.42, modelConfig });

  sendJson(res, 200, { ok: true, prompt: stripCodeFence(content) });
}

async function handleTune(req, res) {
  const body = await readJson(req);
  const modelConfig = resolveModelConfig(body.modelConfig);
  ensureAiConfigured(modelConfig);
  const message = String(body.message || "").trim();
  if (!message) return sendJson(res, 400, { error: "message is required" });

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const content = await callModel([
    {
      role: "system",
      content: `你是 performance-prompter 的调教助手。你的任务是把用户偏好变成简短、可执行、会影响后续提示词生成的规则。
只输出 1-3 句中文规则，不要寒暄。规则应围绕表演密度、节奏、对白、微表情、镜头时长、市场语言等。`
    },
    {
      role: "user",
      content: `历史偏好：${JSON.stringify(history)}

用户新偏好：${message}`
    }
  ], { temperature: 0.25, modelConfig });

  sendJson(res, 200, { ok: true, reply: stripCodeFence(content) });
}

async function handleReviseChat(req, res) {
  const body = await readJson(req);
  const modelConfig = resolveModelConfig(body.modelConfig);
  ensureAiConfigured(modelConfig);

  const currentPrompt = String(body.currentPrompt || "").trim();
  const selectedText = String(body.selectedText || "").trim();
  const profile = String(body.profile || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  const message = String(body.message || "").trim();

  if (!currentPrompt) return sendJson(res, 400, { error: "currentPrompt is required" });
  if (!selectedText) return sendJson(res, 400, { error: "selectedText is required" });
  if (!profile) return sendJson(res, 400, { error: "profile is required" });
  if (!message) return sendJson(res, 400, { error: "message is required" });

  const market = body.market === "domestic" ? "国内市场 / 中文对白" : "海外市场 / 英文对白";

  const content = await callModel([
    { role: "system", content: skillGuide },
    {
      role: "user",
      content: `你是一个“改稿讨论助手”，只讨论怎么改，不直接输出改好的 prompt。

硬性要求：
- 只输出纯中文自然语言建议，不要输出 prompt，不要使用“分镜1：”等格式。
- 先判断用户想改的真正目标，再给出 2-4 句回应。
- 回应应包含：你理解到的修改方向、建议优先改哪些层、哪些原有优点应保留。
- 重点围绕：人物一致性、微动作、潜台词、解释性对白、节奏轻重、关系温度。
- 不要寒暄，不要代码围栏。

目标市场：${market}

当前采用 Prompt：
${currentPrompt.slice(0, 26000)}

目标选段：
${selectedText.slice(0, 10000)}

人物档案：
${profile.slice(0, 20000)}

历史讨论：
${history.map((item) => `${item.role === "user" ? "用户" : "AI"}：${item.text}`).join("\n").slice(0, 8000)}

用户本轮消息：
${message}`
    }
  ], { temperature: 0.35, modelConfig });

  sendJson(res, 200, { ok: true, reply: stripCodeFence(content) });
}

async function handleRevisePrompt(req, res) {
  const body = await readJson(req);
  const modelConfig = resolveModelConfig(body.modelConfig);
  ensureAiConfigured(modelConfig);

  const currentPrompt = String(body.currentPrompt || "").trim();
  const instruction = String(body.instruction || "").trim();
  const selectedText = String(body.selectedText || "").trim();
  const script = String(body.script || "").trim();
  const profile = String(body.profile || "").trim();

  if (!currentPrompt) return sendJson(res, 400, { error: "currentPrompt is required" });
  if (!instruction) return sendJson(res, 400, { error: "instruction is required" });
  if (!profile) return sendJson(res, 400, { error: "profile is required" });

  const content = await callModel([
    { role: "system", content: skillGuide },
    {
      role: "user",
      content: buildSeedancePromptInstruction({
        market: body.market,
        profile,
        tuning: stringifyTuning(body.tuning),
        selectedText,
        fullScript: script,
        selectionRange: body.selectionRange || body.sceneSelectionRange || {},
        currentPrompt,
        extraInstruction: `请根据以下改稿共识重写升级当前 prompt，输出仍必须完全遵守 Seedance 2.0 新格式。\n${instruction}`,
        mode: "revise"
      })
    }
  ], { temperature: 0.38, modelConfig });

  sendJson(res, 200, { ok: true, prompt: stripCodeFence(content) });
}

async function serveStatic(req, res, forcedPathname = "") {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  let pathname = forcedPathname || decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  const relativePath = path.relative(ROOT, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return sendText(res, 403, "Forbidden");
  }
  const publicPath = `/${relativePath.split(path.sep).join("/")}`;
  if (!publicAssets.has(publicPath)) return sendText(res, 404, "Not found");
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return sendText(res, 404, "Not found");
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { ...staticSecurityHeaders, "content-type": contentType });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendText(res, 404, "Not found");
  }
}

async function extractText(filePath, extension) {
  if (extension === ".txt" || extension === ".md") {
    return { text: normalizeExtractedText(await fsp.readFile(filePath, "utf8")), method: "plain-text", warnings: [] };
  }
  if (extension === ".docx") {
    return extractDocx(filePath);
  }
  if (extension === ".doc") {
    return extractDoc(filePath);
  }
  if (extension === ".pdf") {
    return extractPdf(filePath);
  }
  throw new Error("Unsupported file type");
}

async function extractDocx(filePath) {
  let xml = "";
  let method = "docx-unzip";
  if (await commandExists("unzip")) {
    xml = (await runCommand("unzip", ["-p", filePath, "word/document.xml"], { timeoutMs: 15000 })).stdout;
  } else {
    const buffer = await fsp.readFile(filePath);
    xml = extractZipEntry(buffer, "word/document.xml");
    method = "docx-built-in";
  }
  if (!xml) {
    throw new Error("DOCX text extraction failed. Upload TXT as a fallback.");
  }
  const text = xmlToText(xml);
  return { text: normalizeExtractedText(text), method, warnings: [] };
}

function extractZipEntry(buffer, entryName) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  let eocdOffset = -1;

  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66000); index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset === -1) return "";

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = buffer.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < entryCount && cursor < buffer.length; index += 1) {
    if (buffer.readUInt32LE(cursor) !== centralSignature) return "";
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const filenameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const filename = buffer.subarray(cursor + 46, cursor + 46 + filenameLength).toString("utf8");

    if (filename === entryName) {
      if (buffer.readUInt32LE(localOffset) !== localSignature) return "";
      const localFilenameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localFilenameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return zlib.inflateRawSync(data).toString("utf8");
      return "";
    }

    cursor += 46 + filenameLength + extraLength + commentLength;
  }

  return "";
}

async function extractWithTextutil(filePath, kind) {
  if (!(await commandExists("textutil"))) {
    throw new Error(`${kind.toUpperCase()} extraction requires macOS textutil`);
  }
  const result = await runCommand("textutil", ["-convert", "txt", "-stdout", filePath], { timeoutMs: 30000 });
  return { text: normalizeExtractedText(result.stdout), method: "textutil", warnings: [] };
}

async function extractDoc(filePath) {
  if (await commandExists("textutil")) {
    return extractWithTextutil(filePath, "doc");
  }
  if (await commandExists("antiword")) {
    const result = await runCommand("antiword", [filePath], { timeoutMs: 30000 });
    return { text: normalizeExtractedText(result.stdout), method: "antiword", warnings: [] };
  }
  throw new Error("DOC extraction requires macOS textutil or Linux antiword. Upload DOCX/TXT as a fallback.");
}

async function extractPdf(filePath) {
  const warnings = [];
  if (await commandExists("pdftotext")) {
    const result = await runCommand("pdftotext", [filePath, "-"], { timeoutMs: 30000 });
    return { text: normalizeExtractedText(result.stdout), method: "pdftotext", warnings };
  }
  if (await commandExists("textutil")) {
    try {
      const result = await runCommand("textutil", ["-convert", "txt", "-stdout", filePath], { timeoutMs: 30000 });
      const text = normalizeExtractedText(result.stdout);
      if (text.length > 20) return { text, method: "textutil", warnings };
    } catch {
      warnings.push("textutil 未能抽取该 PDF，已使用内置轻量解析器兜底。");
    }
  }
  const buffer = await fsp.readFile(filePath);
  const text = normalizeExtractedText(extractPdfFallback(buffer));
  warnings.push("当前机器缺少 pdftotext；内置 PDF 解析器适合文字型 PDF，扫描件需要 OCR。");
  if (!text) {
    throw new Error("PDF text extraction failed. Install poppler/pdftotext or upload a text-based PDF.");
  }
  return { text, method: "pdf-fallback", warnings };
}

function extractPdfFallback(buffer) {
  const source = buffer.toString("latin1");
  const chunks = [];
  let cursor = 0;
  while (true) {
    const streamStart = source.indexOf("stream", cursor);
    if (streamStart === -1) break;
    const dataStart = source[streamStart + 6] === "\r" && source[streamStart + 7] === "\n"
      ? streamStart + 8
      : source[streamStart + 6] === "\n"
        ? streamStart + 7
        : streamStart + 6;
    const streamEnd = source.indexOf("endstream", dataStart);
    if (streamEnd === -1) break;

    const dictStart = source.lastIndexOf("<<", streamStart);
    const dict = dictStart >= 0 ? source.slice(dictStart, streamStart) : "";
    let streamBytes = buffer.subarray(dataStart, streamEnd);
    if (/\/FlateDecode/.test(dict)) {
      try {
        streamBytes = zlib.inflateSync(streamBytes);
      } catch {
        try {
          streamBytes = zlib.inflateRawSync(streamBytes);
        } catch {
          streamBytes = Buffer.alloc(0);
        }
      }
    }
    const streamText = streamBytes.toString("latin1");
    const extracted = extractPdfTextOperators(streamText);
    if (extracted) chunks.push(extracted);
    cursor = streamEnd + 9;
  }
  return chunks.join("\n");
}

function extractPdfTextOperators(streamText) {
  const out = [];
  const textRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayRegex = /\[((?:.|\n)*?)\]\s*TJ/g;
  let match;
  while ((match = textRegex.exec(streamText))) {
    out.push(decodePdfLiteral(match[0].replace(/\s*Tj$/, "")));
  }
  while ((match = arrayRegex.exec(streamText))) {
    const pieces = [...match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((item) => decodePdfLiteral(item[0]));
    if (pieces.length) out.push(pieces.join(""));
  }
  return out.join(" ");
}

function decodePdfLiteral(value) {
  const inner = value.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char !== "\\") {
      bytes.push(inner.charCodeAt(i) & 0xff);
      continue;
    }
    const next = inner[++i];
    if (next === "n") bytes.push(10);
    else if (next === "r") bytes.push(13);
    else if (next === "t") bytes.push(9);
    else if (next === "b") bytes.push(8);
    else if (next === "f") bytes.push(12);
    else if (/[0-7]/.test(next || "")) {
      let octal = next;
      for (let j = 0; j < 2 && /[0-7]/.test(inner[i + 1] || ""); j += 1) {
        octal += inner[++i];
      }
      bytes.push(parseInt(octal, 8));
    } else if (next) {
      bytes.push(next.charCodeAt(0) & 0xff);
    }
  }
  const buffer = Buffer.from(bytes);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return buffer.subarray(2).swap16().toString("utf16le");
  return buffer.toString("utf8").replace(/\u0000/g, "");
}

function xmlToText(xml) {
  return decodeXmlEntities(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
}

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

async function callModel(messages, options = {}) {
  const modelConfig = options.modelConfig || resolveModelConfig();
  ensureAiConfigured(modelConfig);
  const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${modelConfig.apiKey}`
    },
    body: JSON.stringify({
      model: modelConfig.model,
      temperature: options.temperature ?? 0.35,
      messages
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.error?.message || payload.message || response.statusText;
    throw new Error(`Model request failed: ${detail}`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Model returned an empty response");
  return content;
}

function ensureAiConfigured(modelConfig = resolveModelConfig()) {
  if (!modelConfig.apiKey) {
    throw new Error("AI is not configured. Set OPENAI_API_KEY on the server or enable and fill a client API key.");
  }
}

function resolveModelConfig(raw = {}) {
  const requested = raw && typeof raw === "object" ? raw : {};
  const config = {
    baseUrl: OPENAI_BASE_URL,
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL
  };

  const requestedModel = String(requested.model || "").trim();
  if (requestedModel && requestedModel !== OPENAI_MODEL) {
    if (!ALLOW_MODEL_CONFIG) {
      throw new Error("Model selection is disabled on this deployment.");
    }
    if (MODEL_OPTIONS.length && !MODEL_OPTIONS.includes(requestedModel)) {
      throw new Error(`Model "${requestedModel}" is not allowed by this deployment.`);
    }
    config.model = requestedModel;
  }

  const requestedBaseUrl = String(requested.baseUrl || "").trim();
  if (requestedBaseUrl) {
    if (!ALLOW_CLIENT_BASE_URL) {
      throw new Error("Base URL override is disabled on this deployment.");
    }
    config.baseUrl = normalizeModelBaseUrl(requestedBaseUrl);
  }

  const requestedApiKey = String(requested.apiKey || "").trim();
  if (requestedApiKey) {
    if (!ALLOW_CLIENT_API_KEY) {
      throw new Error("Client API key override is disabled on this deployment.");
    }
    config.apiKey = requestedApiKey;
  }

  return config;
}

function normalizeModelBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Model Base URL is invalid.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Model Base URL must use http or https.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function buildSkillGuide() {
  const snippets = [
    readOptional("SKILL.md"),
    readOptional(path.join("references", "seedance-format.md")),
    readOptional(path.join("references", "structured-physical-direction.md")),
    readOptional(path.join("references", "facs-microexpressions.md")).slice(0, 12000),
    readOptional(path.join("references", "emotion-body-map.md")).slice(0, 12000),
    readOptional(path.join("references", "subtext-externalization.md")).slice(0, 9000),
    readOptional(path.join("references", "tension-scenes.md")).slice(0, 16000)
  ];
  return `你是资深 AI 表演导演，必须遵守 performance-prompter skill。核心原则：可观测，不写意；把剧本冲突转成 Seedance 2.0 能执行的肌肉、肢体、呼吸、眼神、语音维度指令。

以下是本工具的本地 skill 规则与知识库摘录：

${snippets.join("\n\n---\n\n")}`;
}

function readOptional(relativePath) {
  try {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  } catch {
    return "";
  }
}

function stringifyTuning(tuning) {
  if (!Array.isArray(tuning)) return "无额外调教。";
  return tuning
    .filter((item) => item && typeof item.text === "string")
    .slice(-10)
    .map((item) => `${item.role === "user" ? "用户" : "调教器"}：${item.text}`)
    .join("\n") || "无额外调教。";
}

function stripCodeFence(value) {
  return String(value || "")
    .replace(/^```(?:\w+)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
}

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let position = buffer.indexOf(delimiter);
  while (position !== -1) {
    position += delimiter.length;
    if (buffer[position] === 45 && buffer[position + 1] === 45) break;
    if (buffer[position] === 13 && buffer[position + 1] === 10) position += 2;
    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), position);
    if (headerEnd === -1) break;
    const headerText = buffer.subarray(position, headerEnd).toString("utf8");
    const nextBoundary = buffer.indexOf(delimiter, headerEnd + 4);
    if (nextBoundary === -1) break;
    let dataEnd = nextBoundary;
    if (buffer[dataEnd - 2] === 13 && buffer[dataEnd - 1] === 10) dataEnd -= 2;
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText)?.[1] || "";
    const name = /name="([^"]+)"/i.exec(disposition)?.[1] || "";
    const filename = /filename="([^"]*)"/i.exec(disposition)?.[1] || "";
    parts.push({ name, filename, headers: headerText, data: buffer.subarray(headerEnd + 4, dataEnd) });
    position = nextBoundary;
  }
  return parts;
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req, MAX_JSON_BYTES);
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out`));
    }, options.timeoutMs || 15000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

async function commandExists(command) {
  try {
    await runCommand("/usr/bin/which", [command], { timeoutMs: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function getExtractorStatus() {
  return {
    docx: true,
    doc: (await commandExists("textutil")) ? "textutil" : (await commandExists("antiword")) ? "antiword" : false,
    pdf: (await commandExists("pdftotext")) ? "pdftotext" : (await commandExists("textutil")) ? "textutil/fallback" : "fallback"
  };
}

function getPathname(req) {
  try {
    return new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`).pathname;
  } catch {
    return "/";
  }
}

function isAuthorized(req) {
  if (!AUTH_ENABLED) return true;
  const header = req.headers.authorization || "";
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return false;

  let decoded = "";
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }

  const divider = decoded.indexOf(":");
  if (divider === -1) return false;
  const username = decoded.slice(0, divider);
  const password = decoded.slice(divider + 1);
  return safeEqual(username, APP_USER) && safeEqual(password, APP_PASSWORD);
}

function safeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function requestAuth(res) {
  res.writeHead(401, {
    ...apiSecurityHeaders,
    "content-type": "text/plain; charset=utf-8",
    "www-authenticate": "Basic realm=\"Performance Prompter\""
  });
  res.end("Authentication required");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    ...apiSecurityHeaders,
    "content-type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    ...apiSecurityHeaders,
    "content-type": "text/plain; charset=utf-8"
  });
  res.end(text);
}

function sendCors(res, status) {
  res.writeHead(status, apiSecurityHeaders);
  res.end();
}

function safeFilename(filename) {
  return path.basename(String(filename || "upload")).replace(/[^\u4e00-\u9fa5\w .-]+/g, "_");
}

function maskBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "configured";
  }
}

function envFlag(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ""));
}

function buildShotSchedule(duration) {
  const numericDuration = Number(duration);

  if (!Number.isFinite(numericDuration)) {
    return {
      auto: true,
      options: {
        9: [
          "分镜1：时长总和示例 9s",
          "分镜2：时长总和示例 9s"
        ],
        12: [
          "分镜1：时长总和示例 12s",
          "分镜2：时长总和示例 12s"
        ],
        15: [
          "分镜1：时长总和示例 15s",
          "分镜2：时长总和示例 15s"
        ]
      }
    };
  }

  return { auto: false, total: Math.max(1, Math.min(15, numericDuration)) };
}

function buildModelOptions() {
  const raw = process.env.OPENAI_MODEL_OPTIONS || process.env.AIGC_MODEL_OPTIONS || "";
  const listed = raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [...new Set([OPENAI_MODEL, ...listed])];
}

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
