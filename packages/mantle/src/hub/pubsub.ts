import type {
	ProviderBucket,
	TargetBucket,
	CheckBucket,
	ChannelBucket,
	AgentBucket,
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
	ChannelEventRecord,
	AgentEventRecord,
	StoredOutcome,
} from "../store/types.ts";

export type ProviderBucketSubscriber = (bucket: ProviderBucket) => void;
export type TargetBucketSubscriber = (bucket: TargetBucket) => void;
export type CheckBucketSubscriber = (bucket: CheckBucket) => void;

export class ProviderBucketPublisher {
	private subscribers = new Set<ProviderBucketSubscriber>();

	subscribe(fn: ProviderBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: ProviderBucket): void {
		for (const fn of this.subscribers) {
			fn(bucket);
		}
	}
}

export class TargetBucketPublisher {
	private subscribers = new Set<TargetBucketSubscriber>();

	subscribe(fn: TargetBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: TargetBucket): void {
		for (const fn of this.subscribers) {
			fn(bucket);
		}
	}
}

export class CheckBucketPublisher {
	private subscribers = new Set<CheckBucketSubscriber>();

	subscribe(fn: CheckBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: CheckBucket): void {
		for (const fn of this.subscribers) {
			fn(bucket);
		}
	}
}

// Event types match the store record types
export type ProviderEventSubscriber = (event: ProviderEventRecord) => void;
export type TargetEventSubscriber = (event: TargetEventRecord) => void;
export type CheckEventSubscriber = (event: CheckEventRecord) => void;

export class ProviderEventPublisher {
	private subscribers = new Set<ProviderEventSubscriber>();

	subscribe(fn: ProviderEventSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(event: ProviderEventRecord): void {
		for (const fn of this.subscribers) {
			fn(event);
		}
	}
}

export class TargetEventPublisher {
	private subscribers = new Set<TargetEventSubscriber>();

	subscribe(fn: TargetEventSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(event: TargetEventRecord): void {
		for (const fn of this.subscribers) {
			fn(event);
		}
	}
}

export class CheckEventPublisher {
	private subscribers = new Set<CheckEventSubscriber>();

	subscribe(fn: CheckEventSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(event: CheckEventRecord): void {
		for (const fn of this.subscribers) {
			fn(event);
		}
	}
}

export type TargetStatusUpdate = {
	provider: string;
	target: string;
	status: "green" | "red" | "grey" | null;
};
export type TargetStatusSubscriber = (update: TargetStatusUpdate) => void;

export class TargetStatusPublisher {
	private subscribers = new Set<TargetStatusSubscriber>();

	subscribe(fn: TargetStatusSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(update: TargetStatusUpdate): void {
		for (const fn of this.subscribers) {
			fn(update);
		}
	}
}

export type ChannelBucketSubscriber = (bucket: ChannelBucket) => void;

export class ChannelBucketPublisher {
	private subscribers = new Set<ChannelBucketSubscriber>();

	subscribe(fn: ChannelBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: ChannelBucket): void {
		for (const fn of this.subscribers) {
			fn(bucket);
		}
	}
}

export type ChannelEventSubscriber = (event: ChannelEventRecord) => void;

export class ChannelEventPublisher {
	private subscribers = new Set<ChannelEventSubscriber>();

	subscribe(fn: ChannelEventSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(event: ChannelEventRecord): void {
		for (const fn of this.subscribers) {
			fn(event);
		}
	}
}

export type AgentBucketSubscriber = (bucket: AgentBucket) => void;

export class AgentBucketPublisher {
	private subscribers = new Set<AgentBucketSubscriber>();

	subscribe(fn: AgentBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: AgentBucket): void {
		for (const fn of this.subscribers) {
			fn(bucket);
		}
	}
}

export type AgentEventSubscriber = (event: AgentEventRecord) => void;

export class AgentEventPublisher {
	private subscribers = new Set<AgentEventSubscriber>();

	subscribe(fn: AgentEventSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(event: AgentEventRecord): void {
		for (const fn of this.subscribers) {
			fn(event);
		}
	}
}

export type OutcomeWithEvent = StoredOutcome & { eventId: number | undefined; provider: string; target: string; check: string };
export type OutcomeSubscriber = (outcome: OutcomeWithEvent) => void;

export class OutcomePublisher {
	private subscribers = new Set<OutcomeSubscriber>();

	subscribe(fn: OutcomeSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(outcome: OutcomeWithEvent): void {
		for (const fn of this.subscribers) {
			fn(outcome);
		}
	}
}
