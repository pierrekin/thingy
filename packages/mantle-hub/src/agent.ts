import { Hono } from "hono";

export function createAgentApp() {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  return app;
}
