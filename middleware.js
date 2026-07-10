export const config = {
  matcher: ["/:path*"]
};

export function middleware(request) {
  if (new URL(request.url).pathname === "/healthz") return;

  const password = process.env.APP_PASSWORD || process.env.BASIC_AUTH_PASSWORD || "";
  if (!password) return;

  const user = process.env.APP_USER || process.env.BASIC_AUTH_USER || "team";
  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  if (request.headers.get("authorization") === expected) return;

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "www-authenticate": "Basic realm=\"Performance Prompter\""
    }
  });
}
