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
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.AIGC_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.AIGC_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.AIGC_MODEL || "gpt-4.1";
const MODEL_OPTIONS = buildModelOptions();
const ALLOW_MODEL_CONFIG = envFlag("ALLOW_MODEL_CONFIG");
const ALLOW_CLIENT_BASE_URL = envFlag("ALLOW_CLIENT_BASE_URL");
const ALLOW_CLIENT_API_KEY = envFlag("ALLOW_CLIENT_API_KEY");
const APP_USER = process.env.APP_USER || process.env.BASIC_AUTH_USER || "team";
const APP_PASSWORD = process.env.APP_PASSWORD || process.env.BASIC_AUTH_PASSWORD || "";
const AUTH_ENABLED = Boolean(APP_PASSWORD);
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
  "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "vary": "Origin"
};

const skillGuide = buildSkillGuide();

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

    if (req.method === "POST" && pathname === "/api/extract-file") {
      return await handleExtractFile(req, res);
    }

    if (req.method === "POST" && pathname === "/api/generate-profile") {
      return await handleGenerateProfile(req, res);
    }

    if (req.method === "POST" && pathname === "/api/generate-prompt") {
      return await handleGeneratePrompt(req, res);
    }

    if (req.method === "POST" && pathname === "/api/tune") {
      return await handleTune(req, res);
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
- 所有表演描述必须是可观测肌肉、肢体、呼吸、眼神信号。
- 不要写空泛词，例如“高级”“电影感”“很伤心”。

全局调教：
${tuning}

剧本：
${script.slice(0, 60000)}`
    }
  ], { temperature: 0.35, modelConfig });

  sendJson(res, 200, { ok: true, profile: stripCodeFence(content) });
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

  const market = body.market === "domestic" ? "国内题材 / 中文对白" : "欧美市场 / 英文对白";
  const duration = Number(body.duration || 12);
  const sceneType = String(body.sceneType || "auto");
  const tuning = stringifyTuning(body.tuning);

  const content = await callModel([
    { role: "system", content: skillGuide },
    {
      role: "user",
      content: `请把“目标选段”转成 Seedance 2.0 可识别的文戏/情感戏表演 prompt。

硬性要求：
- 严格输出三部分：① 成品提示词 ② 设计说明 ③ 拆条对应。
- 成品提示词必须使用 B 格式：镜头 N (X–Y秒)：，总时长 ${duration} 秒以内。
- 每个镜头 2-4 句可观测表演描述，必须包含微动作/微表情/呼吸/手部或道具交互。
- 每个镜头必须至少覆盖以下三类中的两类：①面部/眼神 ②呼吸/声音 ③肢体/手部/道具；不能只写走位或笼统情绪。
- 欧美市场时，引号内对白必须是地道英文，语气标注用中文；国内题材时对白和标注都用中文。
- 每一句台词必须独占一行并逐字使用“对话：\"台词\" 语气[…]，音量[…]，停顿[…]，口型[…]。”格式；动作段不得直接出现未加“对话：”标签的引号台词。
- 若完整剧本上下文或目标场次注明“长场次”“必须拆条”“多条”，这是不可覆盖的硬约束：即使你认为能在 ${duration} 秒内塞入全部剧情，也不得写“单条完成”；成品只写条1，并在“拆条对应”中逐字写明“条1”和“条2”各自对应的剧情范围。
- 倒数第二段必须是：一致性锁定：脸部、发型、服装保持与@图1一致；口型细腻自然；动作幅度克制；强调呼吸感和眼神微动。
- 最后一段必须是：负向约束：不要字幕、水印和夸张表情；不要生硬切镜；避免抖动和剧烈动作。
- 不要输出代码围栏，不要额外寒暄。

目标市场：${market}
场景类型：${sceneType}
时长：${duration} 秒

全局调教：
${tuning}

人物表演档案：
${profile.slice(0, 24000)}

目标选段：
${selectedText.slice(0, 12000)}

完整剧本上下文：
${script.slice(0, 30000)}`
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
