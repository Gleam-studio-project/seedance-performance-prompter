const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// Keep tests deterministic even when a developer has a populated local .env.
process.env.OPENAI_API_KEY = "";
process.env.AIGC_API_KEY = "";
process.env.APP_PASSWORD = "";
process.env.BASIC_AUTH_PASSWORD = "";

const requestListener = require("../server");

test("builds exact continuous shot schedules for supported durations", () => {
  assert.deepEqual(requestListener.buildShotSchedule(4), [
    "镜头 1 (0–2秒)：",
    "镜头 2 (2–4秒)："
  ]);
  assert.deepEqual(requestListener.buildShotSchedule(9), [
    "镜头 1 (0–3秒)：",
    "镜头 2 (3–6秒)：",
    "镜头 3 (6–9秒)："
  ]);
  assert.deepEqual(requestListener.buildShotSchedule(12), [
    "镜头 1 (0–4秒)：",
    "镜头 2 (4–8秒)：",
    "镜头 3 (8–12秒)："
  ]);
  assert.deepEqual(requestListener.buildShotSchedule(15), [
    "镜头 1 (0–5秒)：",
    "镜头 2 (5–10秒)：",
    "镜头 3 (10–15秒)："
  ]);
});

let server;
let baseUrl;
let address;

test.before(async () => {
  server = http.createServer(requestListener);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("health endpoints accept GET and HEAD without a response body for HEAD", async () => {
  for (const pathname of ["/healthz", "/api/healthz"]) {
    const getResponse = await fetch(`${baseUrl}${pathname}`);
    assert.equal(getResponse.status, 200);
    assert.deepEqual(await getResponse.json(), { ok: true });

    const headResponse = await fetch(`${baseUrl}${pathname}`, { method: "HEAD" });
    assert.equal(headResponse.status, 200);
    assert.equal(await headResponse.text(), "");
  }
});

test("serves only intended public frontend assets", async () => {
  const publicAssets = [
    ["/", "text/html"],
    ["/index.html", "text/html"],
    ["/app.js", "text/javascript"],
    ["/styles.css", "text/css"]
  ];

  for (const [pathname, contentType] of publicAssets) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type") || "", new RegExp(contentType));
  }

  for (const pathname of ["/package.json", "/.env.example", "/README.md", "/api/static/package.json"]) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 404, pathname);
  }
});

test("rejects encoded traversal outside the public root", async () => {
  const response = await rawRequest("/..%2Fpackage.json");
  assert.equal(response.status, 403);
  assert.equal(response.body, "Forbidden");
});

test("status reports capabilities without exposing an API key", async () => {
  const response = await fetch(`${baseUrl}/api/status`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.aiConfigured, false);
  assert.equal(payload.authEnabled, false);
  assert.equal(typeof payload.model, "string");
  assert.equal(typeof payload.modelConfig, "object");
  assert.equal(typeof payload.extractors, "object");
  assert.equal("apiKey" in payload, false);
  assert.equal("apiKey" in payload.modelConfig, false);
});

test("returns bounded errors for unknown routes and invalid JSON", async () => {
  const missingGet = await fetch(`${baseUrl}/api/missing`);
  assert.equal(missingGet.status, 404);

  const missingPost = await fetch(`${baseUrl}/api/missing`, { method: "POST" });
  assert.equal(missingPost.status, 405);
  assert.deepEqual(await missingPost.json(), { error: "Method not allowed" });

  const invalidJson = await fetch(`${baseUrl}/api/generate-profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
  assert.equal(invalidJson.status, 500);
  assert.deepEqual(await invalidJson.json(), { error: "Invalid JSON body" });
});

test("returns a clear model configuration error when no API key exists", async () => {
  const response = await fetch(`${baseUrl}/api/generate-profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ script: "场景：两人在门口沉默对峙。" })
  });
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.match(payload.error, /AI is not configured/);
});

test("extracts and normalizes Markdown uploads", async () => {
  const form = new FormData();
  form.append("file", new Blob(["# 场景\r\n\r\n\r\n角色：你好  \r\n"], { type: "text/markdown" }), "scene.md");

  const response = await fetch(`${baseUrl}/api/extract-file`, { method: "POST", body: form });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.filename, "scene.md");
  assert.equal(payload.method, "plain-text");
  assert.equal(payload.text, "# 场景\n\n角色：你好");
  assert.equal(payload.chars, payload.text.length);
  assert.deepEqual(payload.warnings, []);
});

test("extracts text from a valid DOCX upload", async () => {
  const form = new FormData();
  form.append("file", new Blob([createDocxFixture()], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }), "scene.docx");

  const response = await fetch(`${baseUrl}/api/extract-file`, { method: "POST", body: form });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.filename, "scene.docx");
  assert.match(payload.method, /^docx-(unzip|built-in)$/);
  assert.equal(payload.text, "第一场\n角色：你好");
  assert.equal(payload.chars, payload.text.length);
});

test("rejects unsupported upload extensions", async () => {
  const form = new FormData();
  form.append("file", new Blob(["binary"], { type: "application/octet-stream" }), "scene.exe");

  const response = await fetch(`${baseUrl}/api/extract-file`, { method: "POST", body: form });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Only PDF, DOCX, DOC, TXT and MD files are supported" });
});

function rawRequest(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port: address.port,
      path: pathname,
      method: "GET"
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function createDocxFixture() {
  const filename = Buffer.from("word/document.xml");
  const xml = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    '<w:p><w:r><w:t>第一场</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>角色：你好</w:t></w:r></w:p>' +
    '</w:body></w:document>'
  );
  const checksum = crc32(xml);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(xml.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(filename.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(xml.length, 20);
  central.writeUInt32LE(xml.length, 24);
  central.writeUInt16LE(filename.length, 28);

  const centralOffset = local.length + filename.length + xml.length;
  const centralSize = central.length + filename.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, filename, xml, central, filename, end]);
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
