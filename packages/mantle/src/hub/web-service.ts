import type { ServerWebSocket } from "bun";
import type { BucketStore } from "../store/types.ts";
import type { BucketPublisher, BucketMessage } from "./pubsub.ts";
import { getTimeRangeBounds, DEFAULT_BUCKET_CONFIG } from "./buckets.ts";

type WebSocketData = {
	unsubscribe?: () => void;
};

export class WebService {
	constructor(
		private bucketStore: BucketStore,
		private publisher: BucketPublisher,
	) {}

	async handleConnect(ws: ServerWebSocket<WebSocketData>): Promise<void> {
		// Stream initial bucket states
		const { start, end } = getTimeRangeBounds(DEFAULT_BUCKET_CONFIG);
		const buckets = await this.bucketStore.getBuckets(start, end);
		const total = buckets.length;

		// Calculate the high water mark (total buckets + current pubsub index)
		const baseIndex = this.publisher.getIndex();
		const indexHwm = baseIndex + total;

		for (let i = 0; i < buckets.length; i++) {
			const bucket = buckets[i]!;
			const msg: BucketMessage = {
				...bucket,
				index: baseIndex + i + 1,
				indexHwm,
			};
			ws.send(JSON.stringify({ type: "bucket_state", ...msg }));
		}

		// Subscribe to real-time updates
		const unsubscribe = this.publisher.subscribe((message) => {
			ws.send(JSON.stringify({ type: "bucket_state", ...message }));
		});
		ws.data.unsubscribe = unsubscribe;
	}

	handleDisconnect(ws: ServerWebSocket<WebSocketData>): void {
		if (ws.data.unsubscribe) {
			ws.data.unsubscribe();
		}
	}
}
