import { type Channel, type ChannelInstance, duration } from "mantle-framework";
import type {
  CheckEventEndedRecord,
  CheckEventRecord,
  ProviderEventEndedRecord,
  ProviderEventRecord,
  TargetEventEndedRecord,
  TargetEventRecord,
} from "mantle-store";
import { z } from "zod";

function iso(epoch: number): string {
  return new Date(epoch).toISOString();
}

const COLOR_STARTED = 0xfee75c; // amber
const COLOR_ENDED = 0x57f287; // green

type EmbedField = { name: string; value: string; inline?: boolean };

type Embed = {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  fields: EmbedField[];
};

type DiscordPayload = {
  username?: string;
  avatar_url?: string;
  embeds: Embed[];
};

function buildEmbed(
  title: string,
  message: string,
  color: number,
  timestamp: string,
  fields: EmbedField[],
): Embed {
  return { title, description: message, color, timestamp, fields };
}

class DiscordWebhookChannelInstance implements ChannelInstance {
  private pending = new Set<Promise<void>>();

  constructor(
    private url: string,
    private username: string | undefined,
    private avatarUrl: string | undefined,
    private timeoutMs: number,
  ) {}

  private send(embed: Embed): void {
    const payload: DiscordPayload = { embeds: [embed] };
    if (this.username !== undefined) payload.username = this.username;
    if (this.avatarUrl !== undefined) payload.avatar_url = this.avatarUrl;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const p = fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          process.stderr.write(
            `[${this.url}] Discord webhook failed: ${res.status} ${res.statusText}\n`,
          );
        }
      })
      .catch((err: Error) => {
        process.stderr.write(
          `[${this.url}] Discord webhook error: ${err.message}\n`,
        );
      })
      .finally(() => {
        clearTimeout(timer);
        this.pending.delete(p);
      });
    this.pending.add(p);
  }

  onProviderEventStarted(event: ProviderEventRecord): void {
    this.send(
      buildEmbed(
        event.title,
        event.message,
        COLOR_STARTED,
        iso(event.startTime),
        [
          { name: "Provider", value: event.provider, inline: true },
          { name: "Code", value: event.code, inline: true },
        ],
      ),
    );
  }

  onProviderEventEnded(event: ProviderEventEndedRecord): void {
    this.send(
      buildEmbed(event.title, event.message, COLOR_ENDED, iso(event.endTime), [
        { name: "Provider", value: event.provider, inline: true },
        { name: "Code", value: event.code, inline: true },
      ]),
    );
  }

  onTargetEventStarted(event: TargetEventRecord): void {
    this.send(
      buildEmbed(
        event.title,
        event.message,
        COLOR_STARTED,
        iso(event.startTime),
        [
          { name: "Provider", value: event.provider, inline: true },
          { name: "Target", value: event.target, inline: true },
          { name: "Code", value: event.code, inline: true },
        ],
      ),
    );
  }

  onTargetEventEnded(event: TargetEventEndedRecord): void {
    this.send(
      buildEmbed(event.title, event.message, COLOR_ENDED, iso(event.endTime), [
        { name: "Provider", value: event.provider, inline: true },
        { name: "Target", value: event.target, inline: true },
        { name: "Code", value: event.code, inline: true },
      ]),
    );
  }

  onCheckEventStarted(event: CheckEventRecord): void {
    this.send(
      buildEmbed(
        event.title,
        event.message,
        COLOR_STARTED,
        iso(event.startTime),
        [
          { name: "Provider", value: event.provider, inline: true },
          { name: "Target", value: event.target, inline: true },
          { name: "Check", value: event.check, inline: true },
          { name: "Code", value: event.code, inline: true },
        ],
      ),
    );
  }

  onCheckEventEnded(event: CheckEventEndedRecord): void {
    this.send(
      buildEmbed(event.title, event.message, COLOR_ENDED, iso(event.endTime), [
        { name: "Provider", value: event.provider, inline: true },
        { name: "Target", value: event.target, inline: true },
        { name: "Check", value: event.check, inline: true },
        { name: "Code", value: event.code, inline: true },
      ]),
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.pending);
  }
}

const discordConfig = z.object({
  url: z.string().url(),
  username: z.string().optional(),
  avatar_url: z.string().url().optional(),
  timeout: duration.optional(),
});

const discordWebhookChannel: Channel = {
  name: "@mantle/discord/webhook",
  configSchema: discordConfig,
  createInstance: (config: unknown) => {
    const { url, username, avatar_url, timeout } = discordConfig.parse(config);
    const timeoutMs = timeout ?? 30_000;
    return new DiscordWebhookChannelInstance(
      url,
      username,
      avatar_url,
      timeoutMs,
    );
  },
};

export const channels: Channel[] = [discordWebhookChannel];
