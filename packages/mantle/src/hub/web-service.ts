import type { ServerWebSocket } from "bun";
import type {
	BucketStore,
	EventStore,
	ProviderBucket,
	TargetBucket,
	CheckBucket,
	StoredBuckets,
} from "../store/types.ts";
import type {
	ProviderBucketPublisher,
	TargetBucketPublisher,
	CheckBucketPublisher,
	ProviderBucketMessage,
	TargetBucketMessage,
	CheckBucketMessage,
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
} from "./pubsub.ts";
import { getTimeRangeBounds, DEFAULT_BUCKET_CONFIG, type BucketConfig } from "./buckets.ts";

type WebSocketData = {
	audience: "web" | "agent";
	unsubscribers?: (() => void)[];
};

type BucketPublishers = {
	provider: ProviderBucketPublisher;
	target: TargetBucketPublisher;
	check: CheckBucketPublisher;
};

type EventPublishers = {
	provider: ProviderEventPublisher;
	target: TargetEventPublisher;
	check: CheckEventPublisher;
};

function fillProviderBuckets(
	stored: ProviderBucket[],
	rangeStart: number,
	config: BucketConfig,
): ProviderBucket[] {
	const lookup = new Map<string, ProviderBucket>();
	const providers = new Set<string>();

	for (const bucket of stored) {
		providers.add(bucket.provider);
		lookup.set(`${bucket.provider}:${bucket.bucketStart}`, bucket);
	}

	const result: ProviderBucket[] = [];

	for (const provider of providers) {
		for (let i = 0; i < config.count; i++) {
			const bucketStart = rangeStart + i * config.durationMs;
			const bucketEnd = bucketStart + config.durationMs;
			const existing = lookup.get(`${provider}:${bucketStart}`);

			if (existing) {
				result.push(existing);
			} else {
				result.push({ provider, bucketStart, bucketEnd, status: null });
			}
		}
	}

	return result;
}

function fillTargetBuckets(
	stored: TargetBucket[],
	rangeStart: number,
	config: BucketConfig,
): TargetBucket[] {
	const lookup = new Map<string, TargetBucket>();
	const entities = new Set<string>();

	for (const bucket of stored) {
		const key = `${bucket.provider}/${bucket.target}`;
		entities.add(key);
		lookup.set(`${key}:${bucket.bucketStart}`, bucket);
	}

	const result: TargetBucket[] = [];

	for (const entity of entities) {
		const [provider, target] = entity.split("/") as [string, string];
		for (let i = 0; i < config.count; i++) {
			const bucketStart = rangeStart + i * config.durationMs;
			const bucketEnd = bucketStart + config.durationMs;
			const existing = lookup.get(`${entity}:${bucketStart}`);

			if (existing) {
				result.push(existing);
			} else {
				result.push({ provider, target, bucketStart, bucketEnd, status: null });
			}
		}
	}

	return result;
}

function fillCheckBuckets(
	stored: CheckBucket[],
	rangeStart: number,
	config: BucketConfig,
): CheckBucket[] {
	const lookup = new Map<string, CheckBucket>();
	const entities = new Set<string>();

	for (const bucket of stored) {
		const key = `${bucket.provider}/${bucket.target}/${bucket.check}`;
		entities.add(key);
		lookup.set(`${key}:${bucket.bucketStart}`, bucket);
	}

	const result: CheckBucket[] = [];

	for (const entity of entities) {
		const [provider, target, check] = entity.split("/") as [string, string, string];
		for (let i = 0; i < config.count; i++) {
			const bucketStart = rangeStart + i * config.durationMs;
			const bucketEnd = bucketStart + config.durationMs;
			const existing = lookup.get(`${entity}:${bucketStart}`);

			if (existing) {
				result.push(existing);
			} else {
				result.push({ provider, target, check, bucketStart, bucketEnd, status: null });
			}
		}
	}

	return result;
}

export class WebService {
	constructor(
		private bucketStore: BucketStore,
		private eventStore: EventStore,
		private bucketPublishers: BucketPublishers,
		private eventPublishers: EventPublishers,
	) {}

	async handleConnect(ws: ServerWebSocket<WebSocketData>): Promise<void> {
		const { start, end } = getTimeRangeBounds(DEFAULT_BUCKET_CONFIG);
		ws.data.unsubscribers = [];

		// Get stored buckets and events
		const storedBuckets = await this.bucketStore.getBuckets(start, end);
		const storedEvents = await this.eventStore.getEventsInRange(start, end);

		// Fill buckets for the time range
		const providerBuckets = fillProviderBuckets(storedBuckets.providers, start, DEFAULT_BUCKET_CONFIG);
		const targetBuckets = fillTargetBuckets(storedBuckets.targets, start, DEFAULT_BUCKET_CONFIG);
		const checkBuckets = fillCheckBuckets(storedBuckets.checks, start, DEFAULT_BUCKET_CONFIG);

		// Calculate total count for loading progress
		const totalBuckets = providerBuckets.length + targetBuckets.length + checkBuckets.length;
		const baseIndex = this.bucketPublishers.provider.getIndex() +
			this.bucketPublishers.target.getIndex() +
			this.bucketPublishers.check.getIndex();
		const indexHwm = baseIndex + totalBuckets;
		let currentIndex = baseIndex;

		// Send provider buckets
		for (const bucket of providerBuckets) {
			currentIndex++;
			const msg: ProviderBucketMessage = { ...bucket, index: currentIndex, indexHwm };
			ws.send(JSON.stringify({ type: "provider_bucket", ...msg }));
		}

		// Send target buckets
		for (const bucket of targetBuckets) {
			currentIndex++;
			const msg: TargetBucketMessage = { ...bucket, index: currentIndex, indexHwm };
			ws.send(JSON.stringify({ type: "target_bucket", ...msg }));
		}

		// Send check buckets
		for (const bucket of checkBuckets) {
			currentIndex++;
			const msg: CheckBucketMessage = { ...bucket, index: currentIndex, indexHwm };
			ws.send(JSON.stringify({ type: "check_bucket", ...msg }));
		}

		// Send initial events
		for (const event of storedEvents.providers) {
			ws.send(JSON.stringify({ type: "provider_event", ...event }));
		}
		for (const event of storedEvents.targets) {
			ws.send(JSON.stringify({ type: "target_event", ...event }));
		}
		for (const event of storedEvents.checks) {
			ws.send(JSON.stringify({ type: "check_event", ...event }));
		}

		// Subscribe to real-time bucket updates
		ws.data.unsubscribers.push(
			this.bucketPublishers.provider.subscribe((msg) => {
				ws.send(JSON.stringify({ type: "provider_bucket", ...msg }));
			})
		);
		ws.data.unsubscribers.push(
			this.bucketPublishers.target.subscribe((msg) => {
				ws.send(JSON.stringify({ type: "target_bucket", ...msg }));
			})
		);
		ws.data.unsubscribers.push(
			this.bucketPublishers.check.subscribe((msg) => {
				ws.send(JSON.stringify({ type: "check_bucket", ...msg }));
			})
		);

		// Subscribe to real-time event updates
		ws.data.unsubscribers.push(
			this.eventPublishers.provider.subscribe((event) => {
				ws.send(JSON.stringify({ type: "provider_event", ...event }));
			})
		);
		ws.data.unsubscribers.push(
			this.eventPublishers.target.subscribe((event) => {
				ws.send(JSON.stringify({ type: "target_event", ...event }));
			})
		);
		ws.data.unsubscribers.push(
			this.eventPublishers.check.subscribe((event) => {
				ws.send(JSON.stringify({ type: "check_event", ...event }));
			})
		);
	}

	handleDisconnect(ws: ServerWebSocket<WebSocketData>): void {
		for (const unsub of ws.data.unsubscribers ?? []) {
			unsub();
		}
	}
}
