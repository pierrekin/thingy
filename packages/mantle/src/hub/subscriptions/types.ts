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
	| ProviderBucketMessage
	| TargetBucketMessage
	| CheckBucketMessage
	| MetricsBucketMessage
	| ProviderEventMessage
	| TargetEventMessage
	| CheckEventMessage;

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
	index: number;
	indexHwm: number;
};

export type TargetBucketMessage = {
	type: "target_bucket";
	subscriptionId: string;
	provider: string;
	target: string;
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
	index: number;
	indexHwm: number;
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
	index: number;
	indexHwm: number;
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
	index: number;
	indexHwm: number;
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
	error: string;
};

export type BucketMessage = ProviderBucketMessage | TargetBucketMessage | CheckBucketMessage;
export type EventMessage = ProviderEventMessage | TargetEventMessage | CheckEventMessage;
