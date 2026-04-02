import type { ChannelInstance } from "./channel.ts";
import { getChannel } from "./channels.ts";
import { OperationalError } from "./errors.ts";

export type RegisteredChannel = {
	name: string;
	instance: ChannelInstance;
};

export function createChannelInstances(
	channelConfigs: Record<string, unknown>,
): RegisteredChannel[] {
	const channels: RegisteredChannel[] = [];

	for (const [name, config] of Object.entries(channelConfigs)) {
		const channel = getChannel(name);
		if (!channel) {
			throw new OperationalError(`Unknown channel: '${name}'`);
		}
		channels.push({ name, instance: channel.createInstance(config) });
		console.log(`Channel '${name}' initialized`);
	}

	return channels;
}
