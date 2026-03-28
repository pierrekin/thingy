import type {
	BucketMessage,
	StatusSlot,
	Hub,
	Provider,
	Target,
	Check,
} from "./types";

type BucketData = {
	bucketStart: number;
	bucketEnd: number;
	status: StatusSlot["status"];
};

type EntityBuckets = Map<number, BucketData>;

export type BucketStore = {
	buckets: Map<string, EntityBuckets>;
	index: number;
	indexHwm: number;
};

export function createStore(): BucketStore {
	return {
		buckets: new Map(),
		index: 0,
		indexHwm: 0,
	};
}

function getEntityKey(msg: BucketMessage): string {
	if (msg.check && msg.target) {
		return `${msg.provider}/${msg.target}/${msg.check}`;
	}
	if (msg.target) {
		return `${msg.provider}/${msg.target}`;
	}
	return msg.provider;
}

export function updateStore(store: BucketStore, msg: BucketMessage): BucketStore {
	const key = getEntityKey(msg);
	const entityBuckets = store.buckets.get(key) ?? new Map<number, BucketData>();

	entityBuckets.set(msg.bucketStart, {
		bucketStart: msg.bucketStart,
		bucketEnd: msg.bucketEnd,
		status: msg.status,
	});

	const newBuckets = new Map(store.buckets);
	newBuckets.set(key, entityBuckets);

	return {
		buckets: newBuckets,
		index: msg.index,
		indexHwm: Math.max(store.indexHwm, msg.indexHwm),
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

export function deriveHub(store: BucketStore): Hub {
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
			events: [],
		}));

	const targetsByProvider = new Map<string, Target[]>();
	for (const [key, { provider, target }] of targetKeys) {
		const checksForTarget: Check[] = [];
		for (const [checkKey, checkInfo] of checkKeys) {
			if (checkInfo.provider === provider && checkInfo.target === target) {
				checksForTarget.push({
					name: checkInfo.check,
					statusSlots: bucketsToSlots(store.buckets.get(checkKey)),
					events: [],
				});
			}
		}
		checksForTarget.sort((a, b) => a.name.localeCompare(b.name));

		const targetObj: Target = {
			name: target,
			provider,
			statusSlots: bucketsToSlots(store.buckets.get(key)),
			events: [],
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

export function getLoadingProgress(store: BucketStore): number {
	if (store.indexHwm === 0) return 0;
	return Math.min(100, (store.index / store.indexHwm) * 100);
}

export function isLoading(store: BucketStore): boolean {
	const threshold = 5;
	return store.indexHwm - store.index > threshold;
}
