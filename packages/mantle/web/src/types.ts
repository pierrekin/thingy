export type SlotStatus = "green" | "red" | "grey" | null;

export type StatusSlot = {
	start: number;
	end: number;
	status: SlotStatus;
};

export type BucketMessage = {
	type: "bucket_state";
	provider: string;
	target?: string;
	check?: string;
	bucketStart: number;
	bucketEnd: number;
	status: SlotStatus;
	index: number;
	indexHwm: number;
};

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
