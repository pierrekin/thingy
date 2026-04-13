import type { Channel } from "mantle-framework";
import { channels as logChannels } from "channel-log";
import { channels as webhookChannels } from "channel-webhook";
import { channels as discordChannels } from "channel-discord";

const allChannels = [...logChannels, ...webhookChannels, ...discordChannels];

const registry: Record<string, Channel> = Object.fromEntries(
	allChannels.map((c) => [c.name, c]),
);

export function getChannel(name: string): Channel | undefined {
	return registry[name];
}

export function getAllChannels(): Channel[] {
	return allChannels;
}
