import type {
	ProviderBucket,
	TargetBucket,
	CheckBucket,
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
	StoredOutcome,
} from "../store/types.ts";

// Bucket messages with index tracking for initial load progress
export type ProviderBucketMessage = ProviderBucket & { index: number; indexHwm: number };
export type TargetBucketMessage = TargetBucket & { index: number; indexHwm: number };
export type CheckBucketMessage = CheckBucket & { index: number; indexHwm: number };

export type ProviderBucketSubscriber = (msg: ProviderBucketMessage) => void;
export type TargetBucketSubscriber = (msg: TargetBucketMessage) => void;
export type CheckBucketSubscriber = (msg: CheckBucketMessage) => void;

export class ProviderBucketPublisher {
	private subscribers = new Set<ProviderBucketSubscriber>();
	private index = 0;

	subscribe(fn: ProviderBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: ProviderBucket): void {
		this.index++;
		const msg: ProviderBucketMessage = { ...bucket, index: this.index, indexHwm: this.index };
		for (const fn of this.subscribers) {
			fn(msg);
		}
	}

	getIndex(): number {
		return this.index;
	}
}

export class TargetBucketPublisher {
	private subscribers = new Set<TargetBucketSubscriber>();
	private index = 0;

	subscribe(fn: TargetBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: TargetBucket): void {
		this.index++;
		const msg: TargetBucketMessage = { ...bucket, index: this.index, indexHwm: this.index };
		for (const fn of this.subscribers) {
			fn(msg);
		}
	}

	getIndex(): number {
		return this.index;
	}
}

export class CheckBucketPublisher {
	private subscribers = new Set<CheckBucketSubscriber>();
	private index = 0;

	subscribe(fn: CheckBucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(bucket: CheckBucket): void {
		this.index++;
		const msg: CheckBucketMessage = { ...bucket, index: this.index, indexHwm: this.index };
		for (const fn of this.subscribers) {
			fn(msg);
		}
	}

	getIndex(): number {
		return this.index;
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

export type OutcomeWithEvent = StoredOutcome & { eventId: number };
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
