// ============================================================================
// CLIENT → SERVER MESSAGES
// ============================================================================

export type ClientMessage = StateSubscriptionRequest | MetricsSubscriptionRequest | EventSubscriptionRequest | UnsubscribeRequest;

export type StateSubscriptionRequest = {
	type: "subscribe_state";
	id: string; // client-generated subscription ID
	start: number; // unix timestamp ms
	end: number | null; // null = live mode (rolling window)
	bucketDurationMs: number; // bucket size in milliseconds
	snapshot?: boolean; // if true, server sends snapshot_complete after backfill and closes subscription
};

export type MetricsSubscriptionRequest = {
	type: "subscribe_metrics";
	id: string; // client-generated subscription ID
	provider: string;
	target: string;
	check: string;
	start: number; // unix timestamp ms
	end: number | null; // null = live mode (rolling window)
	bucketDurationMs: number; // bucket size in milliseconds
	snapshot?: boolean; // if true, server sends snapshot_complete after backfill and closes subscription
};

export type EventSubscriptionRequest = {
	type: "subscribe_event";
	id: string;
	eventId: number;
	eventLevel: "provider" | "target" | "check";
};

export type UnsubscribeRequest = {
	type: "unsubscribe";
	id: string;
};

// ============================================================================
// SERVER → CLIENT MESSAGES
// ============================================================================

export type ServerMessage =
	| SubscriptionAckMessage
	| SubscriptionErrorMessage
	| SnapshotCompleteMessage
	| ProviderBucketMessage
	| TargetBucketMessage
	| CheckBucketMessage
	| ChannelBucketMessage
	| AgentBucketMessage
	| MetricsBucketMessage
	| ProviderEventMessage
	| TargetEventMessage
	| CheckEventMessage
	| ChannelEventMessage
	| AgentEventMessage
	| EventInfoMessage
	| EventOutcomeMessage
	| TargetStatusMessage;

export type SnapshotCompleteMessage = {
	type: "snapshot_complete";
	subscriptionId: string;
};

export type SubscriptionAckMessage = {
	type: "subscription_ack";
	id: string;
};

export type SubscriptionErrorMessage = {
	type: "subscription_error";
	id: string;
	error: string;
};

// Bucket messages (now include subscriptionId)
export type ProviderBucketMessage = {
	type: "provider_bucket";
	subscriptionId: string;
	provider: string;
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
};

export type TargetBucketMessage = {
	type: "target_bucket";
	subscriptionId: string;
	provider: string;
	target: string;
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
};

export type CheckBucketMessage = {
	type: "check_bucket";
	subscriptionId: string;
	provider: string;
	target: string;
	check: string;
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
};

export type MetricsBucketMessage = {
	type: "metrics_bucket";
	subscriptionId: string;
	provider: string;
	target: string;
	check: string;
	bucketStart: number;
	bucketEnd: number;
	mean: number | null;
};

// Event messages (now include subscriptionId)
export type ProviderEventMessage = {
	type: "provider_event";
	subscriptionId: string;
	id: number;
	provider: string;
	code: string;
	title: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type TargetEventMessage = {
	type: "target_event";
	subscriptionId: string;
	id: number;
	provider: string;
	target: string;
	code: string;
	title: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type CheckEventMessage = {
	type: "check_event";
	subscriptionId: string;
	id: number;
	provider: string;
	target: string;
	check: string;
	code: string;
	title: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type EventInfoMessage = {
	type: "event_info";
	subscriptionId: string;
	title: string;
	code: string;
	startTime: number;
	endTime: number | null;
};

export type EventOutcomeMessage = {
	type: "event_outcome";
	subscriptionId: string;
	id: number;
	time: number;
	error: string | null;
	violation: string | null;
};

export type TargetStatusMessage = {
	type: "target_status";
	subscriptionId: string;
	provider: string;
	target: string;
	status: "green" | "red" | "grey" | null;
};

export type ChannelBucketMessage = {
	type: "channel_bucket";
	subscriptionId: string;
	channel: string;
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
};

export type ChannelEventMessage = {
	type: "channel_event";
	subscriptionId: string;
	id: number;
	channel: string;
	code: string;
	title: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type AgentBucketMessage = {
	type: "agent_bucket";
	subscriptionId: string;
	agent: string;
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
};

export type AgentEventMessage = {
	type: "agent_event";
	subscriptionId: string;
	id: number;
	agent: string;
	code: string;
	title: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type BucketMessage = ProviderBucketMessage | TargetBucketMessage | CheckBucketMessage | ChannelBucketMessage | AgentBucketMessage;
export type EventMessage = ProviderEventMessage | TargetEventMessage | CheckEventMessage | ChannelEventMessage | AgentEventMessage;
