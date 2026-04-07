import type { ChannelInstance } from "mantle-framework";
import { OperationalError } from "mantle-framework";
import { getChannel } from "./channels.ts";

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
