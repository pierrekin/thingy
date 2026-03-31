import { create } from "zustand";
import type {
	ProviderBucketMessage,
	TargetBucketMessage,
	CheckBucketMessage,
	MetricsBucketMessage,
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
 * Raw metrics bucket data
 */
type MetricsBucketData = {
	bucketStart: number;
	bucketEnd: number;
	mean: number | null;
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

/**
 * The Zustand store state
 */
interface DataStoreState {
	// Buckets organized by: subscriptionId -> entityKey -> bucketStart -> data
	providerBuckets: Map<string, Map<string, Map<number, BucketData>>>;
	targetBuckets: Map<string, Map<string, Map<number, BucketData>>>;
	checkBuckets: Map<string, Map<string, Map<number, BucketData>>>;

	// Metrics buckets organized by: subscriptionId -> entityKey -> bucketStart -> data
	metricsBuckets: Map<string, Map<string, Map<number, MetricsBucketData>>>;

	// Events organized by: subscriptionId -> eventId -> data
	providerEvents: Map<string, Map<number, ProviderEvent>>;
	targetEvents: Map<string, Map<number, TargetEvent>>;
	checkEvents: Map<string, Map<number, CheckEvent>>;

	// Progress tracking per subscription
	progress: Map<string, SubscriptionProgress>;

	// Actions
	addProviderBucket: (msg: ProviderBucketMessage) => void;
	addTargetBucket: (msg: TargetBucketMessage) => void;
	addCheckBucket: (msg: CheckBucketMessage) => void;
	addMetricsBucket: (msg: MetricsBucketMessage) => void;
	addProviderEvent: (msg: ProviderEventMessage) => void;
	addTargetEvent: (msg: TargetEventMessage) => void;
	addCheckEvent: (msg: CheckEventMessage) => void;
	clearSubscription: (subscriptionId: string) => void;
	gcBuckets: (subscriptionId: string, keepCount: number) => void;
}

/**
 * SubscriptionDataStore manages raw data received from the backend using Zustand.
 * This is Layer 1: complete dataset storage, not filtered for display.
 *
 * Data is organized by subscription ID, allowing multiple subscriptions
 * (e.g., different time ranges) to coexist without conflict.
 */
export const useDataStore = create<DataStoreState>((set) => ({
	providerBuckets: new Map(),
	targetBuckets: new Map(),
	checkBuckets: new Map(),
	metricsBuckets: new Map(),
	providerEvents: new Map(),
	targetEvents: new Map(),
	checkEvents: new Map(),
	progress: new Map(),

	addProviderBucket: (msg: ProviderBucketMessage) => {
		set((state) => {
			const providerBuckets = new Map(state.providerBuckets);
			const subBuckets = new Map(providerBuckets.get(msg.subscriptionId) ?? new Map());
			const entityBuckets = new Map(subBuckets.get(msg.provider) ?? new Map());

			entityBuckets.set(msg.bucketStart, {
				bucketStart: msg.bucketStart,
				bucketEnd: msg.bucketEnd,
				status: msg.status,
			});

			subBuckets.set(msg.provider, entityBuckets);
			providerBuckets.set(msg.subscriptionId, subBuckets);

			// Update progress
			const progress = new Map(state.progress);
			const current = progress.get(msg.subscriptionId) ?? { index: 0, indexHwm: 0 };
			progress.set(msg.subscriptionId, {
				index: Math.max(current.index, msg.index),
				indexHwm: Math.max(current.indexHwm, msg.indexHwm),
			});

			return { providerBuckets, progress };
		});
	},

	addTargetBucket: (msg: TargetBucketMessage) => {
		set((state) => {
			const key = `${msg.provider}/${msg.target}`;
			const targetBuckets = new Map(state.targetBuckets);
			const subBuckets = new Map(targetBuckets.get(msg.subscriptionId) ?? new Map());
			const entityBuckets = new Map(subBuckets.get(key) ?? new Map());

			entityBuckets.set(msg.bucketStart, {
				bucketStart: msg.bucketStart,
				bucketEnd: msg.bucketEnd,
				status: msg.status,
			});

			subBuckets.set(key, entityBuckets);
			targetBuckets.set(msg.subscriptionId, subBuckets);

			// Update progress
			const progress = new Map(state.progress);
			const current = progress.get(msg.subscriptionId) ?? { index: 0, indexHwm: 0 };
			progress.set(msg.subscriptionId, {
				index: Math.max(current.index, msg.index),
				indexHwm: Math.max(current.indexHwm, msg.indexHwm),
			});

			return { targetBuckets, progress };
		});
	},

	addCheckBucket: (msg: CheckBucketMessage) => {
		set((state) => {
			const key = `${msg.provider}/${msg.target}/${msg.check}`;
			const checkBuckets = new Map(state.checkBuckets);
			const subBuckets = new Map(checkBuckets.get(msg.subscriptionId) ?? new Map());
			const entityBuckets = new Map(subBuckets.get(key) ?? new Map());

			entityBuckets.set(msg.bucketStart, {
				bucketStart: msg.bucketStart,
				bucketEnd: msg.bucketEnd,
				status: msg.status,
			});

			subBuckets.set(key, entityBuckets);
			checkBuckets.set(msg.subscriptionId, subBuckets);

			// Update progress
			const progress = new Map(state.progress);
			const current = progress.get(msg.subscriptionId) ?? { index: 0, indexHwm: 0 };
			progress.set(msg.subscriptionId, {
				index: Math.max(current.index, msg.index),
				indexHwm: Math.max(current.indexHwm, msg.indexHwm),
			});

			return { checkBuckets, progress };
		});
	},

	addMetricsBucket: (msg: MetricsBucketMessage) => {
		set((state) => {
			const key = `${msg.provider}/${msg.target}/${msg.check}`;
			const metricsBuckets = new Map(state.metricsBuckets);
			const subBuckets = new Map(metricsBuckets.get(msg.subscriptionId) ?? new Map());
			const entityBuckets = new Map(subBuckets.get(key) ?? new Map());

			entityBuckets.set(msg.bucketStart, {
				bucketStart: msg.bucketStart,
				bucketEnd: msg.bucketEnd,
				mean: msg.mean,
			});

			subBuckets.set(key, entityBuckets);
			metricsBuckets.set(msg.subscriptionId, subBuckets);

			// Update progress
			const progress = new Map(state.progress);
			const current = progress.get(msg.subscriptionId) ?? { index: 0, indexHwm: 0 };
			progress.set(msg.subscriptionId, {
				index: Math.max(current.index, msg.index),
				indexHwm: Math.max(current.indexHwm, msg.indexHwm),
			});

			return { metricsBuckets, progress };
		});
	},

	addProviderEvent: (msg: ProviderEventMessage) => {
		set((state) => {
			const providerEvents = new Map(state.providerEvents);
			const subEvents = new Map(providerEvents.get(msg.subscriptionId) ?? new Map());
			subEvents.set(msg.id, {
				id: msg.id,
				provider: msg.provider,
				code: msg.code,
				startTime: msg.startTime,
				endTime: msg.endTime,
				message: msg.message,
			});
			providerEvents.set(msg.subscriptionId, subEvents);
			return { providerEvents };
		});
	},

	addTargetEvent: (msg: TargetEventMessage) => {
		set((state) => {
			const targetEvents = new Map(state.targetEvents);
			const subEvents = new Map(targetEvents.get(msg.subscriptionId) ?? new Map());
			subEvents.set(msg.id, {
				id: msg.id,
				provider: msg.provider,
				target: msg.target,
				code: msg.code,
				startTime: msg.startTime,
				endTime: msg.endTime,
				message: msg.message,
			});
			targetEvents.set(msg.subscriptionId, subEvents);
			return { targetEvents };
		});
	},

	addCheckEvent: (msg: CheckEventMessage) => {
		set((state) => {
			const checkEvents = new Map(state.checkEvents);
			const subEvents = new Map(checkEvents.get(msg.subscriptionId) ?? new Map());
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
			checkEvents.set(msg.subscriptionId, subEvents);
			return { checkEvents };
		});
	},

	clearSubscription: (subscriptionId: string) => {
		set((state) => {
			const providerBuckets = new Map(state.providerBuckets);
			const targetBuckets = new Map(state.targetBuckets);
			const checkBuckets = new Map(state.checkBuckets);
			const metricsBuckets = new Map(state.metricsBuckets);
			const providerEvents = new Map(state.providerEvents);
			const targetEvents = new Map(state.targetEvents);
			const checkEvents = new Map(state.checkEvents);
			const progress = new Map(state.progress);

			providerBuckets.delete(subscriptionId);
			targetBuckets.delete(subscriptionId);
			checkBuckets.delete(subscriptionId);
			metricsBuckets.delete(subscriptionId);
			providerEvents.delete(subscriptionId);
			targetEvents.delete(subscriptionId);
			checkEvents.delete(subscriptionId);
			progress.delete(subscriptionId);

			return {
				providerBuckets,
				targetBuckets,
				checkBuckets,
				metricsBuckets,
				providerEvents,
				targetEvents,
				checkEvents,
				progress,
			};
		});
	},

	gcBuckets: (subscriptionId: string, keepCount: number) => {
		set((state) => {
			const providerBuckets = new Map(state.providerBuckets);
			const targetBuckets = new Map(state.targetBuckets);
			const checkBuckets = new Map(state.checkBuckets);

			// GC provider buckets
			const subProviderBuckets = providerBuckets.get(subscriptionId);
			if (subProviderBuckets) {
				const newSubProviderBuckets = new Map(subProviderBuckets);
				for (const [provider, buckets] of newSubProviderBuckets) {
					if (buckets.size > keepCount * 2) {
						const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
						const toKeep = sorted.slice(-keepCount);
						newSubProviderBuckets.set(provider, new Map(toKeep));
					}
				}
				providerBuckets.set(subscriptionId, newSubProviderBuckets);
			}

			// GC target buckets
			const subTargetBuckets = targetBuckets.get(subscriptionId);
			if (subTargetBuckets) {
				const newSubTargetBuckets = new Map(subTargetBuckets);
				for (const [key, buckets] of newSubTargetBuckets) {
					if (buckets.size > keepCount * 2) {
						const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
						const toKeep = sorted.slice(-keepCount);
						newSubTargetBuckets.set(key, new Map(toKeep));
					}
				}
				targetBuckets.set(subscriptionId, newSubTargetBuckets);
			}

			// GC check buckets
			const subCheckBuckets = checkBuckets.get(subscriptionId);
			if (subCheckBuckets) {
				const newSubCheckBuckets = new Map(subCheckBuckets);
				for (const [key, buckets] of newSubCheckBuckets) {
					if (buckets.size > keepCount * 2) {
						const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
						const toKeep = sorted.slice(-keepCount);
						newSubCheckBuckets.set(key, new Map(toKeep));
					}
				}
				checkBuckets.set(subscriptionId, newSubCheckBuckets);
			}

			return { providerBuckets, targetBuckets, checkBuckets };
		});
	},
}));

// Export getter functions for backward compatibility if needed
export const getProviderBuckets = (subscriptionId: string) =>
	useDataStore.getState().providerBuckets.get(subscriptionId) ?? new Map();

export const getTargetBuckets = (subscriptionId: string) =>
	useDataStore.getState().targetBuckets.get(subscriptionId) ?? new Map();

export const getCheckBuckets = (subscriptionId: string) =>
	useDataStore.getState().checkBuckets.get(subscriptionId) ?? new Map();

export const getMetricsBuckets = (subscriptionId: string) =>
	useDataStore.getState().metricsBuckets.get(subscriptionId) ?? new Map();

export const getMetricsBucketsForCheck = (
	subscriptionId: string,
	provider: string,
	target: string,
	check: string
) => {
	const key = `${provider}/${target}/${check}`;
	const subBuckets = useDataStore.getState().metricsBuckets.get(subscriptionId);
	return subBuckets?.get(key) ?? new Map();
};

export const getProviderEvents = (subscriptionId: string) =>
	useDataStore.getState().providerEvents.get(subscriptionId) ?? new Map();

export const getTargetEvents = (subscriptionId: string) =>
	useDataStore.getState().targetEvents.get(subscriptionId) ?? new Map();

export const getCheckEvents = (subscriptionId: string) =>
	useDataStore.getState().checkEvents.get(subscriptionId) ?? new Map();

export const getProgress = (subscriptionId: string) =>
	useDataStore.getState().progress.get(subscriptionId) ?? { index: 0, indexHwm: 0 };
