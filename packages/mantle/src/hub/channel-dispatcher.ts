import type { ChannelInstance } from "../channel.ts";
import type { BucketStatus } from "mantle-framework";
import type {
	ChannelOutcomeStore,
	ChannelEventStore,
	ChannelBucketStore,
} from "mantle-store";
import type {
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
	ChannelBucketPublisher,
	ChannelEventPublisher,
	ChannelStatusPublisher,
} from "./pubsub.ts";
import { getBucketBounds, DEFAULT_BUCKET_CONFIG, type BucketConfig } from "./buckets.ts";

type EventPublishers = {
	provider: ProviderEventPublisher;
	target: TargetEventPublisher;
	check: CheckEventPublisher;
};

type ChannelPublishers = {
	bucket: ChannelBucketPublisher;
	event: ChannelEventPublisher;
};

type RegisteredChannel = {
	name: string;
	instance: ChannelInstance;
};

type OpenChannelEvent = {
	id: number;
	code: string;
	title: string;
	startTime: number;
	message: string;
};

export class ChannelDispatcher {
	private channels: RegisteredChannel[] = [];
	private unsubscribers: (() => void)[] = [];
	private openEvents = new Map<string, OpenChannelEvent>();

	constructor(
		private outcomeStore: ChannelOutcomeStore,
		private eventStore: ChannelEventStore,
		private bucketStore: ChannelBucketStore,
		private channelPublishers: ChannelPublishers,
		private channelStatusPublisher: ChannelStatusPublisher,
		private bucketConfig: BucketConfig = DEFAULT_BUCKET_CONFIG,
	) {}

	async init(): Promise<void> {
		const openEvents = await this.eventStore.getOpenChannelEvents();
		for (const e of openEvents) {
			this.openEvents.set(e.channel, {
				id: e.id,
				code: e.code,
				title: e.title,
				startTime: e.startTime,
				message: e.message,
			});
		}
		if (openEvents.length > 0) {
			console.log(`Loaded ${openEvents.length} open channel events from database`);
		}
	}

	addChannel(name: string, instance: ChannelInstance): void {
		this.channels.push({ name, instance });
	}

	subscribe(publishers: EventPublishers): void {
		this.unsubscribers.push(
			publishers.provider.subscribe((event) => {
				for (const ch of this.channels) {
					const fn = event.endTime === null
						? () => ch.instance.onProviderEventStarted(event)
						: () => ch.instance.onProviderEventEnded(event);
					this.dispatch(ch.name, fn);
				}
			}),
			publishers.target.subscribe((event) => {
				for (const ch of this.channels) {
					const fn = event.endTime === null
						? () => ch.instance.onTargetEventStarted(event)
						: () => ch.instance.onTargetEventEnded(event);
					this.dispatch(ch.name, fn);
				}
			}),
			publishers.check.subscribe((event) => {
				for (const ch of this.channels) {
					const fn = event.endTime === null
						? () => ch.instance.onCheckEventStarted(event)
						: () => ch.instance.onCheckEventEnded(event);
					this.dispatch(ch.name, fn);
				}
			}),
		);
	}

	private async dispatch(channelName: string, fn: () => void): Promise<void> {
		const time = new Date();
		try {
			fn();
			await this.recordSuccess(channelName, time);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[${channelName}] Channel error: ${message}`);
			await this.recordError(channelName, time, message);
		}
	}

	private async recordSuccess(channel: string, time: Date): Promise<void> {
		await this.outcomeStore.recordChannelOutcome(channel, time, { success: true });

		// Close any open channel event
		const open = this.openEvents.get(channel);
		if (open) {
			await this.eventStore.closeChannelEvent(open.id, time);
			this.channelPublishers.event.publish({
				id: open.id,
				channel,
				code: open.code,
				title: open.title,
				startTime: open.startTime,
				endTime: time.getTime(),
				message: open.message,
			});
			this.openEvents.delete(channel);
			console.log(`[${channel}] CHANNEL EVENT CLOSED: ${open.code}`);
		}

		await this.updateBucket(channel, time, "green");
		await this.publishChannelStatus(channel);
	}

	private async recordError(channel: string, time: Date, message: string): Promise<void> {
		const code = "channel_error";
		const title = "Channel error";

		await this.outcomeStore.recordChannelOutcome(channel, time, { success: false, error: message });

		const open = this.openEvents.get(channel);
		if (!open) {
			const id = await this.eventStore.openChannelEvent(channel, code, title, time, message);
			const startTime = time.getTime();
			this.openEvents.set(channel, { id, code, title, startTime, message });
			this.channelPublishers.event.publish({
				id,
				channel,
				code,
				title,
				startTime,
				endTime: null,
				message,
			});
			console.log(`[${channel}] CHANNEL EVENT OPENED: ${code} - ${title}`);
		}

		await this.updateBucket(channel, time, "red");
		await this.publishChannelStatus(channel);
	}

	private async publishChannelStatus(channel: string): Promise<void> {
		const status = await this.outcomeStore.getLatestChannelStatus(channel);
		this.channelStatusPublisher.publish({ channel, status });
	}

	private async updateBucket(channel: string, time: Date, status: BucketStatus): Promise<void> {
		const { start, end } = getBucketBounds(time, this.bucketConfig);
		const oldStatus = await this.bucketStore.getChannelBucketStatus(channel, start);
		const newStatus = this.mergeStatus(oldStatus, status);

		if (oldStatus !== newStatus) {
			await this.bucketStore.setChannelBucket(channel, start, end, newStatus);
			this.channelPublishers.bucket.publish({
				channel,
				bucketStart: start,
				bucketEnd: end,
				status: newStatus,
			});
		}
	}

	private mergeStatus(existing: BucketStatus | undefined, incoming: BucketStatus): BucketStatus {
		if (existing === "red" || incoming === "red") return "red";
		if (existing === "green" || incoming === "green") return "green";
		if (existing === "grey" || incoming === "grey") return "grey";
		return null;
	}

	cleanup(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
