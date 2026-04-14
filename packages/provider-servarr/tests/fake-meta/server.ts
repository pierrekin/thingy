const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    const body = req.method !== "GET" ? await req.text().catch(() => "") : "";
    console.log(`[fake-meta] ${req.method} ${url.pathname}${url.search}${body ? ` body=${body}` : ""}`);
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`[fake-meta] listening on :${server.port}`);
