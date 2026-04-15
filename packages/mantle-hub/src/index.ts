export { startHub } from "./hub.ts";
export { createChannelInstances, type RegisteredChannel } from "./create-channels.ts";
export { startChannelWorker } from "./channel-worker.ts";
export { startSinkWorker } from "./sink-worker.ts";
export { createSinkInstances, type RegisteredSink } from "./create-sinks.ts";
export { Pipeline, Batch, type OutboxConsumer } from "./outbox-consumer.ts";

// Subscription protocol types (used by hub clients)
export type {
  ClientMessage,
  ServerMessage,
  StateSubscriptionRequest,
  MetricsSubscriptionRequest,
  EventSubscriptionRequest,
  UnsubscribeRequest,
  SnapshotCompleteMessage,
  ProviderBucketMessage,
  TargetBucketMessage,
  CheckBucketMessage,
  ChannelBucketMessage,
  AgentBucketMessage,
  MetricsBucketMessage,
  ProviderEventMessage,
  TargetEventMessage,
  CheckEventMessage,
  ChannelEventMessage,
  AgentEventMessage,
  EventInfoMessage,
  EventOutcomeMessage,
  ProviderStatusMessage,
  TargetStatusMessage,
  ChannelStatusMessage,
  AgentStatusMessage,
  BucketMessage,
  EventMessage,
} from "./subscriptions/types.ts";
