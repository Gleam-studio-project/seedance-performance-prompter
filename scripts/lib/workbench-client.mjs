import http from "node:http";
import requestListener from "../../server.js";

export async function startWorkbenchClient() {
  const server = http.createServer(requestListener);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const authorization = buildAuthorization();

  return {
    async requestJson(pathname, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (authorization) headers.authorization = authorization;
      if (options.body !== undefined) headers["content-type"] = "application/json";

      const response = await fetch(`${baseUrl}${pathname}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new WorkbenchRequestError(response.status, payload.error || response.statusText);
      }
      return payload;
    },
    async close() {
      if (!server.listening) return;
      server.closeIdleConnections?.();
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  };
}

export class WorkbenchRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "WorkbenchRequestError";
    this.status = status;
  }
}

function buildAuthorization() {
  const password = process.env.APP_PASSWORD || process.env.BASIC_AUTH_PASSWORD || "";
  if (!password) return "";
  const user = process.env.APP_USER || process.env.BASIC_AUTH_USER || "team";
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}
