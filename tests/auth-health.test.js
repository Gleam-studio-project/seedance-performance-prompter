const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.OPENAI_API_KEY = "";
process.env.AIGC_API_KEY = "";
process.env.APP_USER = "team";
process.env.APP_PASSWORD = "p0-test-password";
process.env.BASIC_AUTH_PASSWORD = "";

const requestListener = require("../server");

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

test("protected APIs still require valid Basic Auth", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/status`);
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get("www-authenticate") || "", /^Basic /);

  const authorization = `Basic ${Buffer.from("team:p0-test-password").toString("base64")}`;
  const authorized = await fetch(`${baseUrl}/api/status`, { headers: { authorization } });
  assert.equal(authorized.status, 200);
  const payload = await authorized.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.authEnabled, true);
});
