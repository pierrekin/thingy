import type { Channel } from "mantle-framework";
import { channels as logChannels } from "channel-log";

const allChannels = [...logChannels];

const registry: Record<string, Channel> = Object.fromEntries(
	allChannels.map((c) => [c.name, c]),
);

export function getChannel(name: string): Channel | undefined {
	return registry[name];
}

export function getAllChannels(): Channel[] {
	return allChannels;
}
