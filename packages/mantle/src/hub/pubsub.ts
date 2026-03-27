import type { BucketState } from "../store/types.ts";

export type BucketMessage = BucketState & {
	index: number;
	indexHwm: number;
};

export type BucketSubscriber = (message: BucketMessage) => void;

export class BucketPublisher {
	private subscribers = new Set<BucketSubscriber>();
	private index = 0;

	subscribe(fn: BucketSubscriber): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	publish(state: BucketState): void {
		this.index++;
		const message: BucketMessage = {
			...state,
			index: this.index,
			indexHwm: this.index,
		};
		for (const fn of this.subscribers) {
			fn(message);
		}
	}

	getIndex(): number {
		return this.index;
	}
}
