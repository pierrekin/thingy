export type SlotStatus = "green" | "red" | "grey" | null;

export type StatusSlot = {
	start: number;
	end: number;
	status: SlotStatus;
};

// Bucket messages
export type ProviderBucketMessage = {
	type: "provider_bucket";
	provider: string;
	bucketStart: number;
	bucketEnd: number;
	status: SlotStatus;
	index: number;
	indexHwm: number;
};

export type TargetBucketMessage = {
	type: "target_bucket";
	provider: string;
	target: string;
	bucketStart: number;
	bucketEnd: number;
	status: SlotStatus;
	index: number;
	indexHwm: number;
};

export type CheckBucketMessage = {
	type: "check_bucket";
	provider: string;
	target: string;
	check: string;
	bucketStart: number;
	bucketEnd: number;
	status: SlotStatus;
	index: number;
	indexHwm: number;
};

// Event messages
export type ProviderEventMessage = {
	type: "provider_event";
	id: number;
	provider: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type TargetEventMessage = {
	type: "target_event";
	id: number;
	provider: string;
	target: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type CheckEventMessage = {
	type: "check_event";
	id: number;
	provider: string;
	target: string;
	check: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type BucketMessage = ProviderBucketMessage | TargetBucketMessage | CheckBucketMessage;
export type EventMessage = ProviderEventMessage | TargetEventMessage | CheckEventMessage;
export type WebSocketMessage = BucketMessage | EventMessage;

export type Event = {
	id: number;
	code: string;
	message: string;
	startTime: Date;
	endTime: Date | null;
};

export type Check = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export type Target = {
	name: string;
	provider: string;
	statusSlots: StatusSlot[];
	events: Event[];
	checks: Check[];
};

export type Provider = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export type Channel = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export type Hub = {
	name: string;
	providers: Provider[];
	channels: Channel[];
	targets: Target[];
};
