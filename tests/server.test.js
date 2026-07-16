const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");

// Keep tests deterministic even when a developer has a populated local .env.
process.env.OPENAI_API_KEY = "";
process.env.AIGC_API_KEY = "";
process.env.APP_PASSWORD = "present-but-opt-in";
process.env.BASIC_AUTH_PASSWORD = "";
process.env.ENABLE_AUTH = "false";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SECRET_KEY = "";

const requestListener = require("../server");

test("sanitizeProfileOutput cleans json-like profile text into plain Chinese blocks", () => {
  const raw = `
\`\`\`json
[
  {
    "人物ID": "Lily",
    "人物小传": "受过公开羞辱，习惯礼貌微笑。",
    "性格底色": "隐忍、敏感",
    "关系动力学": {"对Alexander":"依赖中带防备","对Marcus":"受伤后强撑体面"},
    "贯穿情感弧线": ["先强撑","后松动"],
    "专属表演习惯Tell": ["左手抓右手手腕","慢眨眼"],
    "核心情绪微表情库": {"压抑悲伤":"嘴唇发白，喉结滚动"}
  }
]
\`\`\`
  `;
  const cleaned = requestListener.sanitizeProfileOutput(raw);
  assert.match(cleaned, /人物ID：Lily/);
  assert.match(cleaned, /关系动力学：/);
  assert.doesNotMatch(cleaned, /```/);
  assert.doesNotMatch(cleaned, /[\{\}\[\]]/);
});

test("project id validator blocks traversal and unsafe ids", () => {
  assert.equal(requestListener.validateProjectId("abc-123"), "abc-123");
  assert.throws(() => requestListener.validateProjectId("../x"));
  assert.throws(() => requestListener.validateProjectId("A"));
  assert.throws(() => requestListener.validateProjectId("a/b"));
});

test("extractScriptWindow returns bounded context around selection", () => {
  const script = "a".repeat(2000) + "SELECTED" + "b".repeat(2000);
  const result = requestListener.extractScriptWindow(script, { start: 2000, end: 2008 }, 1500);
  assert.equal(result.selected, "SELECTED");
  assert.equal(result.before.length, 1500);
  assert.equal(result.after.length, 1500);
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

test("projects api lists empty data set and supports create/get/delete with writable fallback fields", async () => {
  const listResponse = await fetch(`${baseUrl}/api/projects`);
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.ok, true);
  assert.equal(Array.isArray(listPayload.projects), true);
  assert.equal(typeof listPayload.writable, "boolean");

  const createResponse = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectName: "Test Project", market: "overseas" })
  });
  assert.equal(createResponse.status, 200);
  const createPayload = await createResponse.json();
  assert.equal(createPayload.ok, true);
  assert.equal(typeof createPayload.project.id, "string");
  assert.match(createPayload.project.id, /^[a-z0-9-]+$/);

  if (createPayload.writable) {
    const getResponse = await fetch(`${baseUrl}/api/projects/${createPayload.project.id}`);
    assert.equal(getResponse.status, 200);
    const getPayload = await getResponse.json();
    assert.equal(getPayload.ok, true);
    assert.equal(getPayload.project.projectName, "Test Project");

    const putResponse = await fetch(`${baseUrl}/api/projects/${createPayload.project.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectName: "Renamed",
        market: "domestic",
        script: "场景：门口沉默。",
        profile: "人物ID：A",
        prompt: "",
        state: { currentStep: "profile" }
      })
    });
    assert.equal(putResponse.status, 200);
    const putPayload = await putResponse.json();
    assert.equal(putPayload.ok, true);
    assert.equal(putPayload.project.projectName, "Renamed");

    const deleteResponse = await fetch(`${baseUrl}/api/projects/${createPayload.project.id}`, { method: "DELETE" });
    assert.equal(deleteResponse.status, 200);
    const deletePayload = await deleteResponse.json();
    assert.equal(deletePayload.ok, true);
  }
});

test("projects api rejects invalid ids", async () => {
  const response = await fetch(`${baseUrl}/api/projects/../bad`);
  assert.notEqual(response.status, 200);
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

test("supabase projects list uses remote rows and keeps response contract", async () => {
  await withFreshServerEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "secret-key"
  }, async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/projects\?select=id,payload,updated_at&order=updated_at\.desc$/);
    assert.equal(options.method, "GET");
    assert.equal(options.headers.apikey, "secret-key");
    assert.equal(options.headers.authorization, "Bearer secret-key");
    return mockJsonResponse(200, [
      {
        id: "alpha",
        updated_at: "2025-01-02T00:00:00.000Z",
        payload: {
          id: "alpha",
          projectName: "Alpha",
          market: "overseas",
          state: { updatedAt: "2025-01-02T00:00:00.000Z" }
        }
      }
    ]);
  }, async (listener) => {
    const response = await invokeJson(listener, "GET", "/api/projects");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.writable, true);
    assert.equal(response.body.projects.length, 1);
    assert.equal(response.body.projects[0].id, "alpha");
    assert.equal(response.body.projects[0].projectName, "Alpha");
  });
});

test("supabase project create upserts and returns meta", async () => {
  await withFreshServerEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "secret-key"
  }, async (url, options) => {
    assert.equal(String(url), "https://example.supabase.co/rest/v1/projects");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.prefer, "resolution=merge-duplicates,return=representation");
    const rows = JSON.parse(options.body);
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].payload.projectName, "My Project");
    return mockJsonResponse(200, rows);
  }, async (listener) => {
    const response = await invokeJson(listener, "POST", "/api/projects", {
      projectName: "My Project",
      market: "domestic"
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.writable, true);
    assert.match(response.body.project.id, /^[a-z0-9-]+$/);
    assert.equal(response.body.project.projectName, "My Project");
  });
});

test("supabase project get returns stored payload", async () => {
  await withFreshServerEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "secret-key"
  }, async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/projects\?id=eq\.demo-1&select=payload$/);
    assert.equal(options.method, "GET");
    return mockJsonResponse(200, [{
      payload: {
        id: "demo-1",
        projectName: "Demo 1",
        market: "overseas",
        script: "scene",
        profile: "",
        prompt: "",
        state: { projectId: "demo-1", updatedAt: "2025-01-03T00:00:00.000Z" }
      }
    }]);
  }, async (listener) => {
    const response = await invokeJson(listener, "GET", "/api/projects/demo-1");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.writable, true);
    assert.equal(response.body.project.id, "demo-1");
    assert.equal(response.body.project.projectName, "Demo 1");
  });
});

test("supabase project delete calls remote delete endpoint", async () => {
  await withFreshServerEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "secret-key"
  }, async (url, options) => {
    assert.match(String(url), /\/rest\/v1\/projects\?id=eq\.demo-2$/);
    assert.equal(options.method, "DELETE");
    return mockJsonResponse(200, []);
  }, async (listener) => {
    const response = await invokeJson(listener, "DELETE", "/api/projects/demo-2");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true, writable: true });
  });
});

test("supabase upstream failure returns clear sanitized error", async () => {
  await withFreshServerEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "top-secret-value"
  }, async () => mockJsonResponse(500, { message: "db exploded" }, "Internal Server Error"), async (listener) => {
    const response = await invokeJson(listener, "GET", "/api/projects");
    assert.equal(response.status, 500);
    assert.match(response.body.error, /Supabase request failed/);
    assert.match(response.body.error, /500/);
    assert.doesNotMatch(response.body.error, /top-secret-value/);
  });
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

async function withFreshServerEnv(envOverrides, fetchImpl, run) {
  const serverPath = path.resolve(__dirname, "../server.js");
  const previousEnv = {};
  for (const [key, value] of Object.entries(envOverrides)) {
    previousEnv[key] = process.env[key];
    process.env[key] = value;
  }

  const previousFetch = global.fetch;
  global.fetch = fetchImpl;

  delete require.cache[serverPath];

  try {
    const listener = require("../server");
    return await run(listener);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[serverPath];

    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function mockJsonResponse(status, payload, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    async text() {
      return JSON.stringify(payload);
    }
  };
}

function invokeJson(listener, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const request = http.request({
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: body ? { "content-type": "application/json" } : {}
      }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", async () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: response.statusCode,
              body: raw ? JSON.parse(raw) : null
            });
          } catch (error) {
            reject(error);
          } finally {
            server.close();
          }
        });
      });
      request.on("error", (error) => {
        server.close(() => reject(error));
      });
      if (body) request.write(JSON.stringify(body));
      request.end();
    });
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
