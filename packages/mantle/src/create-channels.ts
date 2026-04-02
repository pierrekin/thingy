import type { ChannelInstance } from "./channel.ts";
import { getChannel } from "./channels.ts";
import { OperationalError } from "./errors.ts";

export function createChannelInstances(
	channelConfigs: Record<string, unknown>,
): ChannelInstance[] {
	const instances: ChannelInstance[] = [];

	for (const [name, config] of Object.entries(channelConfigs)) {
		const channel = getChannel(name);
		if (!channel) {
			throw new OperationalError(`Unknown channel: '${name}'`);
		}
		instances.push(channel.createInstance(config));
		console.log(`Channel '${name}' initialized`);
	}

	return instances;
}
