import { Hono } from "hono";
import type { HubConfig } from "mantle-framework";
import type {
  AgentBucketStore,
  AgentEventStore,
  AgentOutcomeStore,
  BucketStore,
  ChannelBucketStore,
  ChannelEventStore,
  ChannelOutcomeStore,
  EventStore,
  MetricsStore,
  OutboxStore,
  OutcomeStore,
} from "mantle-store";
import { createAgentApp } from "./agent.ts";
import type { AgentConfigRegistry } from "./agent-config-registry.ts";
import { AgentRegistry } from "./agent-registry.ts";
import { DEFAULT_BUCKET_CONFIG } from "./buckets.ts";
import { ChannelSessionManager } from "./channel-session.ts";
import {
  AgentBucketPublisher,
  AgentEventPublisher,
  AgentInstancesPublisher,
  AgentStatusPublisher,
  ChannelBucketPublisher,
  ChannelEventPublisher,
  ChannelStatusPublisher,
  CheckBucketPublisher,
  CheckEventPublisher,
  OutcomePublisher,
  ProviderBucketPublisher,
  ProviderEventPublisher,
  ProviderStatusPublisher,
  TargetBucketPublisher,
  TargetEventPublisher,
  TargetStatusPublisher,
} from "./pubsub.ts";
import { createFetchHandler, createWebSocketHandler } from "./server.ts";
import { HubService } from "./service.ts";
import { SinkSessionManager } from "./sink-session.ts";
import { createWebApp } from "./web.ts";
import { WebService } from "./web-service.ts";

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

export async function startHub(
  config: HubConfig,
  outcomeStore: OutcomeStore,
  eventStore: EventStore,
  bucketStore: BucketStore,
  metricsStore: MetricsStore,
  channelStores: ChannelStores,
  agentStores: AgentStores,
  channelOutbox: OutboxStore,
  sinkOutbox: OutboxStore,
  agentConfigRegistry: AgentConfigRegistry,
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

  const channelPublishers = {
    bucket: new ChannelBucketPublisher(),
    event: new ChannelEventPublisher(),
  };
  const channelStatusPublisher = new ChannelStatusPublisher();

  const agentBucketPublisher = new AgentBucketPublisher();
  const agentEventPublisher = new AgentEventPublisher();
  const agentStatusPublisher = new AgentStatusPublisher();
  const agentInstancesPublisher = new AgentInstancesPublisher();

  const hubService = new HubService(
    outcomeStore,
    eventStore,
    bucketStore,
    bucketPublishers,
    eventPublishers,
    outcomePublisher,
    providerStatusPublisher,
    targetStatusPublisher,
    {
      outcomeStore: agentStores.outcomeStore,
      bucketStore: agentStores.bucketStore,
    },
    { bucket: agentBucketPublisher },
    agentStatusPublisher,
    DEFAULT_BUCKET_CONFIG,
    channelOutbox,
    sinkOutbox,
  );
  await hubService.init();

  const channelSessionManager = new ChannelSessionManager(channelOutbox);
  const sinkSessionManager = new SinkSessionManager(sinkOutbox);
  const agentRegistry = new AgentRegistry(agentInstancesPublisher);

  const webService = new WebService(
    bucketStore,
    eventStore,
    metricsStore,
    outcomeStore,
    bucketPublishers,
    eventPublishers,
    outcomePublisher,
    providerStatusPublisher,
    targetStatusPublisher,
    channelPublishers,
    {
      bucketStore: channelStores.bucketStore,
      eventStore: channelStores.eventStore,
      outcomeStore: channelStores.outcomeStore,
    },
    channelStatusPublisher,
    { bucket: agentBucketPublisher, event: agentEventPublisher },
    {
      bucketStore: agentStores.bucketStore,
      eventStore: agentStores.eventStore,
      outcomeStore: agentStores.outcomeStore,
    },
    agentStatusPublisher,
    agentInstancesPublisher,
    agentRegistry,
  );

  const app = new Hono();
  app.route("/agent-api", createAgentApp());
  app.route("/", createWebApp());

  const { ip, port } = config.listen;

  Bun.serve({
    hostname: ip,
    port,
    fetch: createFetchHandler(app),
    websocket: createWebSocketHandler(
      hubService,
      webService,
      channelSessionManager,
      sinkSessionManager,
      agentRegistry,
      agentConfigRegistry,
    ),
  });

  console.log(`Hub listening on ${ip}:${port}`);
}
