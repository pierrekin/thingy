import { Hono } from "hono";
import type { HubConfig } from "../config.ts";
import type { OutcomeStore, EventStore } from "../store/types.ts";
import { createWebApp } from "./web.ts";
import { createAgentApp } from "./agent.ts";
import { createFetchHandler, createWebSocketHandler } from "./server.ts";
import { HubService } from "./service.ts";

export async function startHub(
	config: HubConfig,
	outcomeStore: OutcomeStore,
	eventStore: EventStore,
) {
	const service = new HubService(outcomeStore, eventStore);
	await service.init();

	const app = new Hono();
	app.route("/agent-api", createAgentApp());
	app.route("/", createWebApp());

	const { ip, port } = config.listen;

	Bun.serve({
		hostname: ip,
		port,
		fetch: createFetchHandler(app),
		websocket: createWebSocketHandler(service),
	});

	console.log(`Hub listening on ${ip}:${port}`);
}
