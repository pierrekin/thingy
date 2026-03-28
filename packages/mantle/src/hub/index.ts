import { Hono } from "hono";
import type { HubConfig } from "../config.ts";
import type { OutcomeStore, EventStore, BucketStore } from "../store/types.ts";
import { createWebApp } from "./web.ts";
import { createAgentApp } from "./agent.ts";
import { createFetchHandler, createWebSocketHandler } from "./server.ts";
import { HubService } from "./service.ts";
import { WebService } from "./web-service.ts";
import {
	ProviderBucketPublisher,
	TargetBucketPublisher,
	CheckBucketPublisher,
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
} from "./pubsub.ts";

export async function startHub(
	config: HubConfig,
	outcomeStore: OutcomeStore,
	eventStore: EventStore,
	bucketStore: BucketStore,
) {
	const bucketPublishers = {
		provider: new ProviderBucketPublisher(),
		target: new TargetBucketPublisher(),
		check: new CheckBucketPublisher(),
	};
	const eventPublishers = {
		provider: new ProviderEventPublisher(),
		target: new TargetEventPublisher(),
		check: new CheckEventPublisher(),
	};
	const hubService = new HubService(outcomeStore, eventStore, bucketStore, bucketPublishers, eventPublishers);
	const webService = new WebService(bucketStore, eventStore, bucketPublishers, eventPublishers);

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
