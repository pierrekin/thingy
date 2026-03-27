import { Hono } from "hono";
import type { HubConfig } from "../config.ts";
import type { OutcomeStore, EventStore, BucketStore } from "../store/types.ts";
import { createWebApp } from "./web.ts";
import { createAgentApp } from "./agent.ts";
import { createFetchHandler, createWebSocketHandler } from "./server.ts";
import { HubService } from "./service.ts";
import { WebService } from "./web-service.ts";
import { BucketPublisher } from "./pubsub.ts";

export async function startHub(
	config: HubConfig,
	outcomeStore: OutcomeStore,
	eventStore: EventStore,
	bucketStore: BucketStore,
) {
	const publisher = new BucketPublisher();
	const hubService = new HubService(outcomeStore, eventStore, bucketStore, publisher);
	const webService = new WebService(bucketStore, publisher);

	await hubService.init();

	const app = new Hono();
	app.route("/agent-api", createAgentApp());
	app.route("/", createWebApp());

	const { ip, port } = config.listen;

	Bun.serve({
		hostname: ip,
		port,
		fetch: createFetchHandler(app),
		websocket: createWebSocketHandler(hubService, webService),
	});

	console.log(`Hub listening on ${ip}:${port}`);
}
