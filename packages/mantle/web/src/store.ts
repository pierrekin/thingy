import type {
	ProviderBucketMessage,
	TargetBucketMessage,
	CheckBucketMessage,
	ProviderEventMessage,
	TargetEventMessage,
	CheckEventMessage,
	StatusSlot,
	Hub,
	Provider,
	Target,
	Check,
	Event,
} from "./types";

type BucketData = {
	bucketStart: number;
	bucketEnd: number;
	status: StatusSlot["status"];
};

type ProviderBuckets = Map<number, BucketData>;
type TargetBuckets = Map<number, BucketData>;
type CheckBuckets = Map<number, BucketData>;

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

export type Store = {
	providerBuckets: Map<string, ProviderBuckets>;
	targetBuckets: Map<string, TargetBuckets>;
	checkBuckets: Map<string, CheckBuckets>;
	providerEvents: Map<number, ProviderEvent>;
	targetEvents: Map<number, TargetEvent>;
	checkEvents: Map<number, CheckEvent>;
	index: number;
	indexHwm: number;
};

export function createStore(): Store {
	return {
		providerBuckets: new Map(),
		targetBuckets: new Map(),
		checkBuckets: new Map(),
		providerEvents: new Map(),
		targetEvents: new Map(),
		checkEvents: new Map(),
		index: 0,
		indexHwm: 0,
	};
}

export function updateStoreWithProviderBucket(store: Store, msg: ProviderBucketMessage): Store {
	const entityBuckets = store.providerBuckets.get(msg.provider) ?? new Map<number, BucketData>();

	entityBuckets.set(msg.bucketStart, {
		bucketStart: msg.bucketStart,
		bucketEnd: msg.bucketEnd,
		status: msg.status,
	});

	const newBuckets = new Map(store.providerBuckets);
	newBuckets.set(msg.provider, entityBuckets);

	return {
		...store,
		providerBuckets: newBuckets,
		index: msg.index,
		indexHwm: Math.max(store.indexHwm, msg.indexHwm),
	};
}

export function updateStoreWithTargetBucket(store: Store, msg: TargetBucketMessage): Store {
	const key = `${msg.provider}/${msg.target}`;
	const entityBuckets = store.targetBuckets.get(key) ?? new Map<number, BucketData>();

	entityBuckets.set(msg.bucketStart, {
		bucketStart: msg.bucketStart,
		bucketEnd: msg.bucketEnd,
		status: msg.status,
	});

	const newBuckets = new Map(store.targetBuckets);
	newBuckets.set(key, entityBuckets);

	return {
		...store,
		targetBuckets: newBuckets,
		index: msg.index,
		indexHwm: Math.max(store.indexHwm, msg.indexHwm),
	};
}

export function updateStoreWithCheckBucket(store: Store, msg: CheckBucketMessage): Store {
	const key = `${msg.provider}/${msg.target}/${msg.check}`;
	const entityBuckets = store.checkBuckets.get(key) ?? new Map<number, BucketData>();

	entityBuckets.set(msg.bucketStart, {
		bucketStart: msg.bucketStart,
		bucketEnd: msg.bucketEnd,
		status: msg.status,
	});

	const newBuckets = new Map(store.checkBuckets);
	newBuckets.set(key, entityBuckets);

	return {
		...store,
		checkBuckets: newBuckets,
		index: msg.index,
		indexHwm: Math.max(store.indexHwm, msg.indexHwm),
	};
}

export function updateStoreWithProviderEvent(store: Store, msg: ProviderEventMessage): Store {
	const newEvents = new Map(store.providerEvents);
	newEvents.set(msg.id, {
		id: msg.id,
		provider: msg.provider,
		code: msg.code,
		startTime: msg.startTime,
		endTime: msg.endTime,
		message: msg.message,
	});

	return {
		...store,
		providerEvents: newEvents,
	};
}

export function updateStoreWithTargetEvent(store: Store, msg: TargetEventMessage): Store {
	const newEvents = new Map(store.targetEvents);
	newEvents.set(msg.id, {
		id: msg.id,
		provider: msg.provider,
		target: msg.target,
		code: msg.code,
		startTime: msg.startTime,
		endTime: msg.endTime,
		message: msg.message,
	});

	return {
		...store,
		targetEvents: newEvents,
	};
}

export function updateStoreWithCheckEvent(store: Store, msg: CheckEventMessage): Store {
	const newEvents = new Map(store.checkEvents);
	newEvents.set(msg.id, {
		id: msg.id,
		provider: msg.provider,
		target: msg.target,
		check: msg.check,
		code: msg.code,
		startTime: msg.startTime,
		endTime: msg.endTime,
		message: msg.message,
	});

	return {
		...store,
		checkEvents: newEvents,
	};
}

function bucketsToSlots(entityBuckets: Map<number, BucketData> | undefined): StatusSlot[] {
	if (!entityBuckets) return [];

	const entries = Array.from(entityBuckets.values());
	entries.sort((a, b) => a.bucketStart - b.bucketStart);

	return entries.map((b) => ({
		start: b.bucketStart,
		end: b.bucketEnd,
		status: b.status,
	}));
}

function toEvent(e: ProviderEvent | TargetEvent | CheckEvent): Event {
	return {
		id: e.id,
		code: e.code,
		message: e.message,
		startTime: new Date(e.startTime),
		endTime: e.endTime ? new Date(e.endTime) : null,
	};
}

export function deriveHub(store: Store): Hub {
	// Get all unique providers from all bucket types
	const providerNames = new Set<string>();
	for (const provider of store.providerBuckets.keys()) {
		providerNames.add(provider);
	}

	// Get all targets
	const targetKeys = new Map<string, { provider: string; target: string }>();
	for (const key of store.targetBuckets.keys()) {
		const [provider, target] = key.split("/") as [string, string];
		providerNames.add(provider);
		targetKeys.set(key, { provider, target });
	}

	// Get all checks
	const checkKeys = new Map<string, { provider: string; target: string; check: string }>();
	for (const key of store.checkBuckets.keys()) {
		const [provider, target, check] = key.split("/") as [string, string, string];
		providerNames.add(provider);
		const targetKey = `${provider}/${target}`;
		if (!targetKeys.has(targetKey)) {
			targetKeys.set(targetKey, { provider, target });
		}
		checkKeys.set(key, { provider, target, check });
	}

	// Build providers with their events
	const providers: Provider[] = Array.from(providerNames)
		.sort()
		.map((name) => {
			const events: Event[] = [];
			for (const e of store.providerEvents.values()) {
				if (e.provider === name) {
					events.push(toEvent(e));
				}
			}
			events.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

			return {
				name,
				statusSlots: bucketsToSlots(store.providerBuckets.get(name)),
				events,
			};
		});

	// Build targets with their checks and events
	const targetsByProvider = new Map<string, Target[]>();
	for (const [key, { provider, target }] of targetKeys) {
		// Get checks for this target
		const checksForTarget: Check[] = [];
		for (const [checkKey, checkInfo] of checkKeys) {
			if (checkInfo.provider === provider && checkInfo.target === target) {
				const checkEvents: Event[] = [];
				for (const e of store.checkEvents.values()) {
					if (e.provider === provider && e.target === target && e.check === checkInfo.check) {
						checkEvents.push(toEvent(e));
					}
				}
				checkEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

				checksForTarget.push({
					name: checkInfo.check,
					statusSlots: bucketsToSlots(store.checkBuckets.get(checkKey)),
					events: checkEvents,
				});
			}
		}
		checksForTarget.sort((a, b) => a.name.localeCompare(b.name));

		// Get events for this target
		const targetEvents: Event[] = [];
		for (const e of store.targetEvents.values()) {
			if (e.provider === provider && e.target === target) {
				targetEvents.push(toEvent(e));
			}
		}
		targetEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

		const targetObj: Target = {
			name: target,
			provider,
			statusSlots: bucketsToSlots(store.targetBuckets.get(key)),
			events: targetEvents,
			checks: checksForTarget,
		};

		const existing = targetsByProvider.get(provider) ?? [];
		existing.push(targetObj);
		targetsByProvider.set(provider, existing);
	}

	const targets: Target[] = [];
	for (const providerTargets of targetsByProvider.values()) {
		providerTargets.sort((a, b) => a.name.localeCompare(b.name));
		targets.push(...providerTargets);
	}

	return {
		name: "Hub",
		providers,
		channels: [],
		targets,
	};
}

export function getLoadingProgress(store: Store): number {
	if (store.indexHwm === 0) return 0;
	return Math.min(100, (store.index / store.indexHwm) * 100);
}

export function isLoading(store: Store): boolean {
	const threshold = 5;
	return store.indexHwm - store.index > threshold;
}
