import type { OutboxEntry } from "mantle-store";

export interface OutboxConsumer {
	next(): Promise<OutboxEntry | null>;
	ack(cursor: number): Promise<void>;
	close(): void;
}

export class Pipeline {
	private unconfirmed = 0;
	private waiter: (() => void) | null = null;
	private lastEntry: OutboxEntry | null = null;

	constructor(
		private consumer: OutboxConsumer,
		private maxUnacked: number,
	) {}

	async next(): Promise<OutboxEntry | null> {
		if (this.lastEntry) {
			this.unconfirmed++;
			const onSettled = () => {
				this.unconfirmed--;
				if (this.waiter && this.unconfirmed < this.maxUnacked) {
					const resolve = this.waiter;
					this.waiter = null;
					resolve();
				}
			};
			this.consumer.ack(this.lastEntry.id).then(onSettled, onSettled);
		}

		if (this.unconfirmed >= this.maxUnacked) {
			await new Promise<void>(resolve => {
				this.waiter = resolve;
			});
		}

		this.lastEntry = await this.consumer.next();
		return this.lastEntry;
	}

	close(): void {
		if (this.lastEntry) {
			void this.consumer.ack(this.lastEntry.id);
			this.lastEntry = null;
		}
		this.consumer.close();
	}
}

export class Batch {
	private pendingNext: Promise<OutboxEntry | null> | null = null;

	constructor(
		private consumer: OutboxConsumer,
		private maxSize: number,
		private lingerMs: number,
	) {}

	private nextEntry(): Promise<OutboxEntry | null> {
		if (this.pendingNext) {
			const p = this.pendingNext;
			this.pendingNext = null;
			return p;
		}
		return this.consumer.next();
	}

	async next(): Promise<OutboxEntry[] | null> {
		const first = await this.nextEntry();
		if (!first) return null;

		const entries: OutboxEntry[] = [first];

		const deadline = Date.now() + this.lingerMs;
		while (entries.length < this.maxSize) {
			const remaining = deadline - Date.now();
			if (remaining <= 0) break;

			const entryPromise = this.consumer.next();
			const result = await Promise.race([
				entryPromise.then(entry => ({ entry, timedOut: false as const })),
				new Promise<{ entry: null; timedOut: true }>(resolve =>
					setTimeout(() => resolve({ entry: null, timedOut: true }), remaining),
				),
			]);

			if (result.timedOut) {
				this.pendingNext = entryPromise;
				break;
			}

			if (!result.entry) break;
			entries.push(result.entry);
		}

		await this.consumer.ack(entries[entries.length - 1]!.id);
		return entries;
	}

	close(): void {
		this.consumer.close();
	}
}
