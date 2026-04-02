import type { Channel } from "./channel.ts";
import log from "channel-log";

const channels: Record<string, Channel> = {
	log,
};

export function getChannel(name: string): Channel | undefined {
	return channels[name];
}

export function getAllChannels(): Channel[] {
	return Object.values(channels);
}
