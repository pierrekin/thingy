import { Hono } from "hono";
import { assets } from "../generated/assets.ts";

export function createWebApp() {
  const app = new Hono();

  // SPA API routes
  app.get("/api/health", (c) => c.json({ ok: true }));

  // Static assets and SPA fallback
  app.get("/*", (c) => {
    const path = c.req.path === "/" ? "index.html" : c.req.path.slice(1);
    const asset = assets[path];

    if (asset) {
      const body = Buffer.from(asset.content, "base64");
      return c.body(body, {
        headers: { "Content-Type": asset.contentType },
      });
    }

    // SPA fallback
    const index = assets["index.html"];
    if (index) {
      const body = Buffer.from(index.content, "base64");
      return c.body(body, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return c.notFound();
  });

  return app;
}
