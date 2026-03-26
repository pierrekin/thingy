import { Hono } from "hono";
import type { HubConfig } from "../config.ts";
import { createWebApp } from "./web.ts";
import { createAgentApp } from "./agent.ts";
import { createFetchHandler, websocket } from "./server.ts";

export function startHub(config: HubConfig) {
	const app = new Hono();

	app.route("/agent-api", createAgentApp());
	app.route("/", createWebApp());

	const { ip, port } = config.listen;

	Bun.serve({
		hostname: ip,
		port,
		fetch: createFetchHandler(app),
		websocket,
	});

	console.log(`Hub listening on ${ip}:${port}`);
}
