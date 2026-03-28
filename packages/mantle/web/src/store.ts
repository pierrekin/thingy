import type {
	BucketMessage,
	EventMessage,
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

type EntityBuckets = Map<number, BucketData>;

type StoredEvent = {
	id: number;
	provider: string;
	target?: string;
	check?: string;
	code: string;
	startTime: number;
	endTime: number | null;
	message: string;
};

export type Store = {
	buckets: Map<string, EntityBuckets>;
	events: Map<number, StoredEvent>;
	index: number;
	indexHwm: number;
};

export function createStore(): Store {
	return {
		buckets: new Map(),
		events: new Map(),
		index: 0,
		indexHwm: 0,
	};
}

function getBucketEntityKey(msg: BucketMessage): string {
	if (msg.check && msg.target) {
		return `${msg.provider}/${msg.target}/${msg.check}`;
	}
	if (msg.target) {
		return `${msg.provider}/${msg.target}`;
	}
	return msg.provider;
}

export function updateStoreWithBucket(store: Store, msg: BucketMessage): Store {
	const key = getBucketEntityKey(msg);
	const entityBuckets = store.buckets.get(key) ?? new Map<number, BucketData>();

	entityBuckets.set(msg.bucketStart, {
		bucketStart: msg.bucketStart,
		bucketEnd: msg.bucketEnd,
		status: msg.status,
	});

	const newBuckets = new Map(store.buckets);
	newBuckets.set(key, entityBuckets);

	return {
		...store,
		buckets: newBuckets,
		index: msg.index,
		indexHwm: Math.max(store.indexHwm, msg.indexHwm),
	};
}

export function updateStoreWithEvent(store: Store, msg: EventMessage): Store {
	const newEvents = new Map(store.events);
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
		events: newEvents,
	};
}

function bucketsToSlots(entityBuckets: EntityBuckets | undefined): StatusSlot[] {
	if (!entityBuckets) return [];

	const entries = Array.from(entityBuckets.values());
	entries.sort((a, b) => a.bucketStart - b.bucketStart);

	return entries.map((b) => ({
		start: b.bucketStart,
		end: b.bucketEnd,
		status: b.status,
	}));
}

function storedEventToEvent(e: StoredEvent): Event {
	return {
		id: e.id,
		code: e.code,
		message: e.message,
		startTime: new Date(e.startTime),
		endTime: e.endTime ? new Date(e.endTime) : null,
	};
}

function getEventsForEntity(
	events: Map<number, StoredEvent>,
	provider: string,
	target?: string,
	check?: string,
): Event[] {
	const result: Event[] = [];
	for (const e of events.values()) {
		if (e.provider === provider) {
			if (check !== undefined) {
				if (e.target === target && e.check === check) {
					result.push(storedEventToEvent(e));
				}
			} else if (target !== undefined) {
				if (e.target === target && e.check === undefined) {
					result.push(storedEventToEvent(e));
				}
			} else {
				if (e.target === undefined) {
					result.push(storedEventToEvent(e));
				}
			}
		}
	}
	return result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}

export function deriveHub(store: Store): Hub {
	const providerNames = new Set<string>();
	const targetKeys = new Map<string, { provider: string; target: string }>();
	const checkKeys = new Map<
		string,
		{ provider: string; target: string; check: string }
	>();

	for (const key of store.buckets.keys()) {
		const parts = key.split("/");
		if (parts.length === 1) {
			providerNames.add(parts[0]);
		} else if (parts.length === 2) {
			providerNames.add(parts[0]);
			targetKeys.set(key, { provider: parts[0], target: parts[1] });
		} else if (parts.length === 3) {
			providerNames.add(parts[0]);
			const targetKey = `${parts[0]}/${parts[1]}`;
			targetKeys.set(targetKey, { provider: parts[0], target: parts[1] });
			checkKeys.set(key, {
				provider: parts[0],
				target: parts[1],
				check: parts[2],
			});
		}
	}

	const providers: Provider[] = Array.from(providerNames)
		.sort()
		.map((name) => ({
			name,
			statusSlots: bucketsToSlots(store.buckets.get(name)),
			events: getEventsForEntity(store.events, name),
		}));

	const targetsByProvider = new Map<string, Target[]>();
	for (const [key, { provider, target }] of targetKeys) {
		const checksForTarget: Check[] = [];
		for (const [checkKey, checkInfo] of checkKeys) {
			if (checkInfo.provider === provider && checkInfo.target === target) {
				checksForTarget.push({
					name: checkInfo.check,
					statusSlots: bucketsToSlots(store.buckets.get(checkKey)),
					events: getEventsForEntity(store.events, provider, target, checkInfo.check),
				});
			}
		}
		checksForTarget.sort((a, b) => a.name.localeCompare(b.name));

		const targetObj: Target = {
			name: target,
			provider,
			statusSlots: bucketsToSlots(store.buckets.get(key)),
			events: getEventsForEntity(store.events, provider, target),
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
