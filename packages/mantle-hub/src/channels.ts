import { channels as discordChannels } from "channel-discord";
import { channels as emailChannels } from "channel-email";
import { channels as logChannels } from "channel-log";
import { channels as telegramChannels } from "channel-telegram";
import { channels as webhookChannels } from "channel-webhook";
import type { Channel } from "mantle-framework";

const allChannels = [
  ...logChannels,
  ...webhookChannels,
  ...discordChannels,
  ...telegramChannels,
  ...emailChannels,
];

const registry: Record<string, Channel> = Object.fromEntries(
  allChannels.map((c) => [c.name, c]),
);

export function getChannel(name: string): Channel | undefined {
  return registry[name];
}

export function getAllChannels(): Channel[] {
  return allChannels;
}
