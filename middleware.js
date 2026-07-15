export const config = {
  matcher: ["/:path*"]
};

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};
const publicPaths = new Set(["/", "/index.html", "/app.js", "/styles.css"]);

export default function middleware(request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/healthz" || publicPaths.has(pathname)) return;
  if (!pathname.startsWith("/api/")) {
    return new Response("Not found", { status: 404, headers: securityHeaders });
  }

  const password = process.env.APP_PASSWORD || process.env.BASIC_AUTH_PASSWORD || "";
  if (!envFlag("ENABLE_AUTH") || !password) return;

  const user = process.env.APP_USER || process.env.BASIC_AUTH_USER || "team";
  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  if (request.headers.get("authorization") === expected) return;

  return new Response("Authentication required", {
    status: 401,
    headers: {
      ...securityHeaders,
      "www-authenticate": "Basic realm=\"Performance Prompter\""
    }
  });
}

function envFlag(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ""));
}
