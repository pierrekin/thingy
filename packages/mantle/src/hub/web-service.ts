import type { ServerWebSocket } from "bun";
import type { BucketStore, BucketState, EventStore } from "../store/types.ts";
import type { BucketPublisher, BucketMessage, EventPublisher, EventState } from "./pubsub.ts";
import { getTimeRangeBounds, DEFAULT_BUCKET_CONFIG, type BucketConfig } from "./buckets.ts";

type WebSocketData = {
	unsubscribeBuckets?: () => void;
	unsubscribeEvents?: () => void;
};

function fillBuckets(
	stored: BucketState[],
	rangeStart: number,
	config: BucketConfig,
): BucketState[] {
	// Build lookup: "provider/target/check" + bucketStart -> BucketState
	const lookup = new Map<string, BucketState>();
	const entities = new Set<string>();

	for (const bucket of stored) {
		const key = bucket.check
			? `${bucket.provider}/${bucket.target}/${bucket.check}`
			: bucket.target
				? `${bucket.provider}/${bucket.target}`
				: bucket.provider;
		entities.add(key);
		lookup.set(`${key}:${bucket.bucketStart}`, bucket);
	}

	const result: BucketState[] = [];

	for (const entity of entities) {
		const parts = entity.split("/");
		const provider = parts[0]!;
		const target = parts[1];
		const check = parts[2];

		for (let i = 0; i < config.count; i++) {
			const bucketStart = rangeStart + i * config.durationMs;
			const bucketEnd = bucketStart + config.durationMs;
			const existing = lookup.get(`${entity}:${bucketStart}`);

			if (existing) {
				result.push(existing);
			} else {
				result.push({
					provider,
					target,
					check,
					bucketStart,
					bucketEnd,
					status: null,
				});
			}
		}
	}

	return result;
}

export class WebService {
	constructor(
		private bucketStore: BucketStore,
		private eventStore: EventStore,
		private bucketPublisher: BucketPublisher,
		private eventPublisher: EventPublisher,
	) {}

	async handleConnect(ws: ServerWebSocket<WebSocketData>): Promise<void> {
		const { start, end } = getTimeRangeBounds(DEFAULT_BUCKET_CONFIG);

		// Send initial buckets
		const storedBuckets = await this.bucketStore.getBuckets(start, end);
		const filledBuckets = fillBuckets(storedBuckets, start, DEFAULT_BUCKET_CONFIG);

		const baseIndex = this.bucketPublisher.getIndex();
		const indexHwm = baseIndex + filledBuckets.length;

		for (let i = 0; i < filledBuckets.length; i++) {
			const bucket = filledBuckets[i]!;
			const msg: BucketMessage = {
				...bucket,
				index: baseIndex + i + 1,
				indexHwm,
			};
			ws.send(JSON.stringify({ type: "bucket_state", ...msg }));
		}

		// Send initial events
		const events = await this.eventStore.getEventsInRange(start, end);
		for (const event of events) {
			ws.send(JSON.stringify({ type: "event", ...event }));
		}

		// Subscribe to real-time bucket updates
		const unsubscribeBuckets = this.bucketPublisher.subscribe((message) => {
			ws.send(JSON.stringify({ type: "bucket_state", ...message }));
		});
		ws.data.unsubscribeBuckets = unsubscribeBuckets;

		// Subscribe to real-time event updates
		const unsubscribeEvents = this.eventPublisher.subscribe((event) => {
			ws.send(JSON.stringify({ type: "event", ...event }));
		});
		ws.data.unsubscribeEvents = unsubscribeEvents;
	}

	handleDisconnect(ws: ServerWebSocket<WebSocketData>): void {
		ws.data.unsubscribeBuckets?.();
		ws.data.unsubscribeEvents?.();
	}
}
