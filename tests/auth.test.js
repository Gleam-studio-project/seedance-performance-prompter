const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const APP_USER = "team";
const APP_PASSWORD = "security-test-password";
const SERVER_API_KEY = "server-key-must-never-appear";
const CLIENT_API_KEY = "client-key-must-never-appear";
const CORS_ORIGIN = "https://workbench.example.test";

process.env.NODE_ENV = "production";
process.env.OPENAI_API_KEY = SERVER_API_KEY;
process.env.AIGC_API_KEY = "";
process.env.OPENAI_BASE_URL = "https://models.example.test/v1";
process.env.OPENAI_MODEL = "deepseek-chat";
process.env.OPENAI_MODEL_OPTIONS = "deepseek-chat,deepseek-reasoner";
process.env.ALLOW_MODEL_CONFIG = "true";
process.env.ALLOW_CLIENT_API_KEY = "false";
process.env.ALLOW_CLIENT_BASE_URL = "false";
process.env.APP_USER = APP_USER;
process.env.APP_PASSWORD = APP_PASSWORD;
process.env.ENABLE_AUTH = "true";
process.env.BASIC_AUTH_PASSWORD = "";
process.env.CORS_ORIGIN = CORS_ORIGIN;

const requestListener = require("../server");

test("Vercel deployment defers model controls to project environment", () => {
  const config = JSON.parse(readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
  for (const name of [
    "ALLOW_MODEL_CONFIG",
    "ALLOW_CLIENT_API_KEY",
    "ALLOW_CLIENT_BASE_URL",
    "OPENAI_MODEL_OPTIONS"
  ]) {
    assert.equal(name in config.env, false, name);
  }
});

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(requestListener);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("health checks bypass Basic Auth for GET and HEAD", async () => {
  for (const pathname of ["/healthz", "/api/healthz"]) {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(`${baseUrl}${pathname}`, { method });
      assert.equal(response.status, 200, `${method} ${pathname}`);
      if (method === "HEAD") assert.equal(await response.text(), "");
      else assert.deepEqual(await response.json(), { ok: true });
    }
  }
});

test("OPTIONS remains available without credentials", async () => {
  const response = await fetch(`${baseUrl}/api/generate-prompt`, {
    method: "OPTIONS",
    headers: { origin: CORS_ORIGIN }
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), CORS_ORIGIN);
  assert.equal(await response.text(), "");
});

test("protected APIs reject missing and invalid Basic Auth", async () => {
  for (const authorization of ["", basicAuth("team", "wrong-password"), basicAuth("wrong-user", APP_PASSWORD)]) {
    const response = await fetch(`${baseUrl}/api/status`, {
      headers: authorization ? { authorization } : {}
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate") || "", /^Basic /);
  }
});

test("authorized status is protected by production security headers and never exposes secrets", async () => {
  const response = await authorizedRequest("/api/status");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), CORS_ORIGIN);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");

  const raw = await response.text();
  assert.equal(raw.includes(SERVER_API_KEY), false);
  assert.equal(raw.includes(APP_PASSWORD), false);
  const payload = JSON.parse(raw);
  assert.equal(payload.ok, true);
  assert.equal(payload.authEnabled, true);
});

test("authorized static HTML has a restrictive content security policy", async () => {
  const response = await authorizedRequest("/");
  assert.equal(response.status, 200);
  const csp = response.headers.get("content-security-policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self'/);
});

test("model selection is restricted to the configured allowlist", async () => {
  const response = await postProfile({ model: "not-allowed-model" });
  assert.equal(response.status, 500);
  const raw = await response.text();
  assert.match(raw, /not allowed/);
  assert.equal(raw.includes(SERVER_API_KEY), false);
});

test("client Base URL override is disabled", async () => {
  const response = await postProfile({ baseUrl: "http://127.0.0.1:9999/v1" });
  assert.equal(response.status, 500);
  const raw = await response.text();
  assert.match(raw, /Base URL override is disabled/);
  assert.equal(raw.includes(SERVER_API_KEY), false);
});

test("client API key override is disabled without echoing either key", async () => {
  const response = await postProfile({ apiKey: CLIENT_API_KEY });
  assert.equal(response.status, 500);
  const raw = await response.text();
  assert.match(raw, /Client API key override is disabled/);
  assert.equal(raw.includes(CLIENT_API_KEY), false);
  assert.equal(raw.includes(SERVER_API_KEY), false);
});

function authorizedRequest(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...(options.headers || {}), authorization: basicAuth(APP_USER, APP_PASSWORD) }
  });
}

function postProfile(modelConfig) {
  return authorizedRequest("/api/generate-profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ script: "场景：两人在门口沉默对峙。", modelConfig })
  });
}

function basicAuth(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}
