import type { ChannelInstance } from "../channel.ts";
import type {
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
} from "./pubsub.ts";

type EventPublishers = {
	provider: ProviderEventPublisher;
	target: TargetEventPublisher;
	check: CheckEventPublisher;
};

export class ChannelDispatcher {
	private channels: ChannelInstance[] = [];
	private unsubscribers: (() => void)[] = [];

	addChannel(channel: ChannelInstance): void {
		this.channels.push(channel);
	}

	subscribe(publishers: EventPublishers): void {
		this.unsubscribers.push(
			publishers.provider.subscribe((event) => {
				for (const ch of this.channels) {
					if (event.endTime === null) {
						ch.onProviderEventStarted(event);
					} else {
						ch.onProviderEventEnded(event);
					}
				}
			}),
			publishers.target.subscribe((event) => {
				for (const ch of this.channels) {
					if (event.endTime === null) {
						ch.onTargetEventStarted(event);
					} else {
						ch.onTargetEventEnded(event);
					}
				}
			}),
			publishers.check.subscribe((event) => {
				for (const ch of this.channels) {
					if (event.endTime === null) {
						ch.onCheckEventStarted(event);
					} else {
						ch.onCheckEventEnded(event);
					}
				}
			}),
		);
	}

	cleanup(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
