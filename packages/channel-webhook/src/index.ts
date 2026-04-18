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

type Notification = {
  type: string;
  time: string;
  started_at: string;
  ended_at?: string;
  provider: string;
  target?: string;
  check?: string;
  code: string;
  title: string;
  message: string;
};

class WebhookChannelInstance implements ChannelInstance {
  private pending = new Set<Promise<void>>();

  constructor(
    private url: string,
    private method: string,
    private headers: Record<string, string>,
    private timeoutMs: number,
  ) {}

  private send(n: Notification): void {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const p = fetch(this.url, {
      method: this.method,
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify(n),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          process.stderr.write(
            `[${this.url}] Webhook failed: ${res.status} ${res.statusText}\n`,
          );
        }
      })
      .catch((err: Error) => {
        process.stderr.write(`[${this.url}] Webhook error: ${err.message}\n`);
      })
      .finally(() => {
        clearTimeout(timer);
        this.pending.delete(p);
      });
    this.pending.add(p);
  }

  onProviderEventStarted(event: ProviderEventRecord): void {
    this.send({
      type: "provider_event_started",
      time: iso(event.startTime),
      started_at: iso(event.startTime),
      provider: event.provider,
      code: event.code,
      title: event.title,
      message: event.message,
    });
  }

  onProviderEventEnded(event: ProviderEventEndedRecord): void {
    this.send({
      type: "provider_event_ended",
      time: iso(event.endTime),
      started_at: iso(event.startTime),
      ended_at: iso(event.endTime),
      provider: event.provider,
      code: event.code,
      title: event.title,
      message: event.message,
    });
  }

  onTargetEventStarted(event: TargetEventRecord): void {
    this.send({
      type: "target_event_started",
      time: iso(event.startTime),
      started_at: iso(event.startTime),
      provider: event.provider,
      target: event.target,
      code: event.code,
      title: event.title,
      message: event.message,
    });
  }

  onTargetEventEnded(event: TargetEventEndedRecord): void {
    this.send({
      type: "target_event_ended",
      time: iso(event.endTime),
      started_at: iso(event.startTime),
      ended_at: iso(event.endTime),
      provider: event.provider,
      target: event.target,
      code: event.code,
      title: event.title,
      message: event.message,
    });
  }

  onCheckEventStarted(event: CheckEventRecord): void {
    this.send({
      type: "check_event_started",
      time: iso(event.startTime),
      started_at: iso(event.startTime),
      provider: event.provider,
      target: event.target,
      check: event.check,
      code: event.code,
      title: event.title,
      message: event.message,
    });
  }

  onCheckEventEnded(event: CheckEventEndedRecord): void {
    this.send({
      type: "check_event_ended",
      time: iso(event.endTime),
      started_at: iso(event.startTime),
      ended_at: iso(event.endTime),
      provider: event.provider,
      target: event.target,
      check: event.check,
      code: event.code,
      title: event.title,
      message: event.message,
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.pending);
  }
}

const webhookConfig = z.object({
  url: z.string().url(),
  method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: duration.optional(),
});

const webhookChannel: Channel = {
  name: "@mantle/webhook/json",
  configSchema: webhookConfig,
  createInstance: (config: unknown) => {
    const { url, method, headers, timeout } = webhookConfig.parse(config);
    const timeoutMs = timeout ?? 30_000;
    return new WebhookChannelInstance(url, method, headers ?? {}, timeoutMs);
  },
};

export const channels: Channel[] = [webhookChannel];
