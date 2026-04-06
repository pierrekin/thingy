import { Hono } from "hono";
import type { HubConfig } from "../config.ts";
import type { OutcomeStore, EventStore, BucketStore, MetricsStore, ChannelOutcomeStore, ChannelEventStore, ChannelBucketStore, AgentOutcomeStore, AgentEventStore, AgentBucketStore } from "mantle-store";
import type { ChannelInstance } from "../channel.ts";
import { createWebApp } from "./web.ts";
import { createAgentApp } from "./agent.ts";
import { createFetchHandler, createWebSocketHandler } from "./server.ts";
import { HubService } from "./service.ts";
import { WebService } from "./web-service.ts";
import { ChannelDispatcher } from "./channel-dispatcher.ts";
import {
	ProviderBucketPublisher,
	TargetBucketPublisher,
	CheckBucketPublisher,
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
	ChannelBucketPublisher,
	ChannelEventPublisher,
	AgentBucketPublisher,
	AgentEventPublisher,
	OutcomePublisher,
	ProviderStatusPublisher,
	TargetStatusPublisher,
	ChannelStatusPublisher,
	AgentStatusPublisher,
} from "./pubsub.ts";

type ChannelStores = {
	outcomeStore: ChannelOutcomeStore;
	eventStore: ChannelEventStore;
	bucketStore: ChannelBucketStore;
};

type AgentStores = {
	outcomeStore: AgentOutcomeStore;
	eventStore: AgentEventStore;
	bucketStore: AgentBucketStore;
};

type RegisteredChannel = {
	name: string;
	instance: ChannelInstance;
};

export async function startHub(
	config: HubConfig,
	outcomeStore: OutcomeStore,
	eventStore: EventStore,
	bucketStore: BucketStore,
	metricsStore: MetricsStore,
	channels: RegisteredChannel[] = [],
	channelStores?: ChannelStores,
	agentStores?: AgentStores,
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
	const outcomePublisher = new OutcomePublisher();
	const providerStatusPublisher = new ProviderStatusPublisher();
	const targetStatusPublisher = new TargetStatusPublisher();

	let channelPublishers: { bucket: ChannelBucketPublisher; event: ChannelEventPublisher } | null = null;
	let channelStatusPublisher: ChannelStatusPublisher | null = null;

	if (channels.length > 0 && channelStores) {
		channelPublishers = {
			bucket: new ChannelBucketPublisher(),
			event: new ChannelEventPublisher(),
		};
		channelStatusPublisher = new ChannelStatusPublisher();
		const dispatcher = new ChannelDispatcher(
			channelStores.outcomeStore,
			channelStores.eventStore,
			channelStores.bucketStore,
			channelPublishers,
			channelStatusPublisher,
		);
		for (const ch of channels) {
			dispatcher.addChannel(ch.name, ch.instance);
		}
		await dispatcher.init();
		dispatcher.subscribe(eventPublishers);
	}

	const agentBucketPublisher = agentStores ? new AgentBucketPublisher() : null;
	const agentEventPublisher = agentStores ? new AgentEventPublisher() : null;
	const agentStatusPublisher = agentStores ? new AgentStatusPublisher() : null;

	const hubService = new HubService(
		outcomeStore, eventStore, bucketStore,
		bucketPublishers, eventPublishers, outcomePublisher,
		providerStatusPublisher, targetStatusPublisher,
		agentStores ? { outcomeStore: agentStores.outcomeStore, bucketStore: agentStores.bucketStore } : null,
		agentBucketPublisher ? { bucket: agentBucketPublisher } : null,
		agentStatusPublisher,
	);
	const webService = new WebService(
		bucketStore, eventStore, metricsStore, outcomeStore,
		bucketPublishers, eventPublishers, outcomePublisher,
		providerStatusPublisher, targetStatusPublisher,
		channelPublishers,
		channelStores ? { bucketStore: channelStores.bucketStore, eventStore: channelStores.eventStore, outcomeStore: channelStores.outcomeStore } : null,
		channelStatusPublisher,
		agentBucketPublisher && agentEventPublisher ? { bucket: agentBucketPublisher, event: agentEventPublisher } : null,
		agentStores ? { bucketStore: agentStores.bucketStore, eventStore: agentStores.eventStore, outcomeStore: agentStores.outcomeStore } : null,
		agentStatusPublisher,
	);

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
