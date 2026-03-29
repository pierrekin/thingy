import type {
	ProviderBucketMessage,
	TargetBucketMessage,
	CheckBucketMessage,
	ProviderEventMessage,
	TargetEventMessage,
	CheckEventMessage,
} from "../types";

/**
 * Raw bucket data without the subscription metadata
 */
type BucketData = {
	bucketStart: number;
	bucketEnd: number;
	status: "green" | "red" | "grey" | null;
};

/**
 * Raw event data
 */
type ProviderEvent = {
	id: number;
	provider: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

type TargetEvent = {
	id: number;
	provider: string;
	target: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

type CheckEvent = {
	id: number;
	provider: string;
	target: string;
	check: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

/**
 * Progress tracking for a subscription
 */
type SubscriptionProgress = {
	index: number;
	indexHwm: number;
};

type ChangeListener = () => void;

/**
 * SubscriptionDataStore manages raw data received from the backend.
 * This is Layer 1: complete dataset storage, not filtered for display.
 *
 * Data is organized by subscription ID, allowing multiple subscriptions
 * (e.g., different time ranges) to coexist without conflict.
 */
export class SubscriptionDataStore {
	// Buckets organized by: subscriptionId -> entityKey -> bucketStart -> data
	private providerBuckets = new Map<string, Map<string, Map<number, BucketData>>>();
	private targetBuckets = new Map<string, Map<string, Map<number, BucketData>>>();
	private checkBuckets = new Map<string, Map<string, Map<number, BucketData>>>();

	// Events organized by: subscriptionId -> eventId -> data
	private providerEvents = new Map<string, Map<number, ProviderEvent>>();
	private targetEvents = new Map<string, Map<number, TargetEvent>>();
	private checkEvents = new Map<string, Map<number, CheckEvent>>();

	// Progress tracking per subscription
	private progress = new Map<string, SubscriptionProgress>();

	// Change listeners for reactivity
	private listeners = new Set<ChangeListener>();

	/**
	 * Subscribe to data changes
	 */
	subscribe(listener: ChangeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Notify all listeners of a change
	 */
	private notifyListeners(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	/**
	 * Add a provider bucket
	 */
	addProviderBucket(msg: ProviderBucketMessage): void {
		const subBuckets = this.providerBuckets.get(msg.subscriptionId) ?? new Map();
		const entityBuckets = subBuckets.get(msg.provider) ?? new Map();

		entityBuckets.set(msg.bucketStart, {
			bucketStart: msg.bucketStart,
			bucketEnd: msg.bucketEnd,
			status: msg.status,
		});

		subBuckets.set(msg.provider, entityBuckets);
		this.providerBuckets.set(msg.subscriptionId, subBuckets);

		this.updateProgress(msg.subscriptionId, msg.index, msg.indexHwm);
		this.notifyListeners();
	}

	/**
	 * Add a target bucket
	 */
	addTargetBucket(msg: TargetBucketMessage): void {
		const key = `${msg.provider}/${msg.target}`;
		const subBuckets = this.targetBuckets.get(msg.subscriptionId) ?? new Map();
		const entityBuckets = subBuckets.get(key) ?? new Map();

		entityBuckets.set(msg.bucketStart, {
			bucketStart: msg.bucketStart,
			bucketEnd: msg.bucketEnd,
			status: msg.status,
		});

		subBuckets.set(key, entityBuckets);
		this.targetBuckets.set(msg.subscriptionId, subBuckets);

		this.updateProgress(msg.subscriptionId, msg.index, msg.indexHwm);
		this.notifyListeners();
	}

	/**
	 * Add a check bucket
	 */
	addCheckBucket(msg: CheckBucketMessage): void {
		const key = `${msg.provider}/${msg.target}/${msg.check}`;
		const subBuckets = this.checkBuckets.get(msg.subscriptionId) ?? new Map();
		const entityBuckets = subBuckets.get(key) ?? new Map();

		entityBuckets.set(msg.bucketStart, {
			bucketStart: msg.bucketStart,
			bucketEnd: msg.bucketEnd,
			status: msg.status,
		});

		subBuckets.set(key, entityBuckets);
		this.checkBuckets.set(msg.subscriptionId, subBuckets);

		this.updateProgress(msg.subscriptionId, msg.index, msg.indexHwm);
		this.notifyListeners();
	}

	/**
	 * Add a provider event
	 */
	addProviderEvent(msg: ProviderEventMessage): void {
		const subEvents = this.providerEvents.get(msg.subscriptionId) ?? new Map();
		subEvents.set(msg.id, {
			id: msg.id,
			provider: msg.provider,
			code: msg.code,
			startTime: msg.startTime,
			endTime: msg.endTime,
			message: msg.message,
		});
		this.providerEvents.set(msg.subscriptionId, subEvents);
		this.notifyListeners();
	}

	/**
	 * Add a target event
	 */
	addTargetEvent(msg: TargetEventMessage): void {
		const subEvents = this.targetEvents.get(msg.subscriptionId) ?? new Map();
		subEvents.set(msg.id, {
			id: msg.id,
			provider: msg.provider,
			target: msg.target,
			code: msg.code,
			startTime: msg.startTime,
			endTime: msg.endTime,
			message: msg.message,
		});
		this.targetEvents.set(msg.subscriptionId, subEvents);
		this.notifyListeners();
	}

	/**
	 * Add a check event
	 */
	addCheckEvent(msg: CheckEventMessage): void {
		const subEvents = this.checkEvents.get(msg.subscriptionId) ?? new Map();
		subEvents.set(msg.id, {
			id: msg.id,
			provider: msg.provider,
			target: msg.target,
			check: msg.check,
			code: msg.code,
			startTime: msg.startTime,
			endTime: msg.endTime,
			message: msg.message,
		});
		this.checkEvents.set(msg.subscriptionId, subEvents);
		this.notifyListeners();
	}

	/**
	 * Update progress tracking
	 */
	private updateProgress(subscriptionId: string, index: number, indexHwm: number): void {
		const current = this.progress.get(subscriptionId) ?? { index: 0, indexHwm: 0 };
		this.progress.set(subscriptionId, {
			index: Math.max(current.index, index),
			indexHwm: Math.max(current.indexHwm, indexHwm),
		});
	}

	/**
	 * Get all provider buckets for a subscription
	 */
	getProviderBuckets(subscriptionId: string): Map<string, Map<number, BucketData>> {
		return this.providerBuckets.get(subscriptionId) ?? new Map();
	}

	/**
	 * Get all target buckets for a subscription
	 */
	getTargetBuckets(subscriptionId: string): Map<string, Map<number, BucketData>> {
		return this.targetBuckets.get(subscriptionId) ?? new Map();
	}

	/**
	 * Get all check buckets for a subscription
	 */
	getCheckBuckets(subscriptionId: string): Map<string, Map<number, BucketData>> {
		return this.checkBuckets.get(subscriptionId) ?? new Map();
	}

	/**
	 * Get all provider events for a subscription
	 */
	getProviderEvents(subscriptionId: string): Map<number, ProviderEvent> {
		return this.providerEvents.get(subscriptionId) ?? new Map();
	}

	/**
	 * Get all target events for a subscription
	 */
	getTargetEvents(subscriptionId: string): Map<number, TargetEvent> {
		return this.targetEvents.get(subscriptionId) ?? new Map();
	}

	/**
	 * Get all check events for a subscription
	 */
	getCheckEvents(subscriptionId: string): Map<number, CheckEvent> {
		return this.checkEvents.get(subscriptionId) ?? new Map();
	}

	/**
	 * Get progress for a subscription
	 */
	getProgress(subscriptionId: string): SubscriptionProgress {
		return this.progress.get(subscriptionId) ?? { index: 0, indexHwm: 0 };
	}

	/**
	 * Clear all data for a subscription (e.g., when unsubscribing)
	 */
	clearSubscription(subscriptionId: string): void {
		this.providerBuckets.delete(subscriptionId);
		this.targetBuckets.delete(subscriptionId);
		this.checkBuckets.delete(subscriptionId);
		this.providerEvents.delete(subscriptionId);
		this.targetEvents.delete(subscriptionId);
		this.checkEvents.delete(subscriptionId);
		this.progress.delete(subscriptionId);
		this.notifyListeners();
	}

	/**
	 * Garbage collect old buckets for a subscription to keep memory bounded.
	 * Keeps the most recent N buckets per entity.
	 */
	gcBuckets(subscriptionId: string, keepCount: number): void {
		// GC provider buckets
		const providerBuckets = this.providerBuckets.get(subscriptionId);
		if (providerBuckets) {
			for (const [provider, buckets] of providerBuckets) {
				if (buckets.size > keepCount * 2) {
					const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
					const toKeep = sorted.slice(-keepCount);
					providerBuckets.set(provider, new Map(toKeep));
				}
			}
		}

		// GC target buckets
		const targetBuckets = this.targetBuckets.get(subscriptionId);
		if (targetBuckets) {
			for (const [key, buckets] of targetBuckets) {
				if (buckets.size > keepCount * 2) {
					const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
					const toKeep = sorted.slice(-keepCount);
					targetBuckets.set(key, new Map(toKeep));
				}
			}
		}

		// GC check buckets
		const checkBuckets = this.checkBuckets.get(subscriptionId);
		if (checkBuckets) {
			for (const [key, buckets] of checkBuckets) {
				if (buckets.size > keepCount * 2) {
					const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
					const toKeep = sorted.slice(-keepCount);
					checkBuckets.set(key, new Map(toKeep));
				}
			}
		}
	}
}

// Global singleton instance
export const dataStore = new SubscriptionDataStore();
