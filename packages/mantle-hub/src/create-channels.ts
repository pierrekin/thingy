import type { ChannelInstance } from "mantle-framework";
import { OperationalError } from "mantle-framework";
import { getChannel } from "./channels.ts";

export type RegisteredChannel = {
	name: string;
	instance: ChannelInstance;
};

function getChannelType(instanceName: string, config: unknown): string {
	if (
		config &&
		typeof config === "object" &&
		"type" in config &&
		typeof (config as Record<string, unknown>).type === "string"
	) {
		return (config as Record<string, unknown>).type as string;
	}
	return instanceName;
}

export function createChannelInstances(
	channelConfigs: Record<string, unknown>,
): RegisteredChannel[] {
	const channels: RegisteredChannel[] = [];

	for (const [name, config] of Object.entries(channelConfigs)) {
		const channelType = getChannelType(name, config);
		const channel = getChannel(channelType);
		if (!channel) {
			throw new OperationalError(`Unknown channel type: '${channelType}'`);
		}
		channels.push({ name, instance: channel.createInstance(config) });
		console.log(`Channel '${name}' (${channelType}) initialized`);
	}

	return channels;
}
