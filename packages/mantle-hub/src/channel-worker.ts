import type { ChannelInstance } from "mantle-framework";
import type { OutboxEntry } from "mantle-store";
import type { ChannelOutboxPayload } from "./channel-outbox.ts";
import { type OutboxConsumer, Pipeline } from "./outbox-consumer.ts";

const DEFAULT_MAX_UNACKED = 10;
const RECONNECT_MS = 2000;

function dispatch(
  instance: ChannelInstance,
  payload: ChannelOutboxPayload,
): void {
  switch (payload.type) {
    case "provider_event_started":
      instance.onProviderEventStarted(payload.event);
      break;
    case "provider_event_ended":
      instance.onProviderEventEnded(payload.event);
      break;
    case "target_event_started":
      instance.onTargetEventStarted(payload.event);
      break;
    case "target_event_ended":
      instance.onTargetEventEnded(payload.event);
      break;
    case "check_event_started":
      instance.onCheckEventStarted(payload.event);
      break;
    case "check_event_ended":
      instance.onCheckEventEnded(payload.event);
      break;
  }
}

class WebSocketConsumer implements OutboxConsumer {
  private ws: WebSocket | null = null;
  private queue: OutboxEntry[] = [];
  private entryWaiter: ((entry: OutboxEntry | null) => void) | null = null;
  private ackResolvers = new Map<number, () => void>();
  private closed = false;

  constructor(
    private url: string,
    private workerId: string,
  ) {
    this.connect();
  }

  private connect(): void {
    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: "channel_hello", channelId: this.workerId }),
      );
    };

    ws.onmessage = (event) => {
      const lines = (event.data as string).split("\n");
      for (const line of lines) {
        if (!line) continue;
        const msg = JSON.parse(line) as { type: string };

        if (msg.type === "channel_batch") {
          const batch = msg as unknown as { entries: OutboxEntry[] };
          for (const entry of batch.entries) {
            if (this.entryWaiter) {
              const resolve = this.entryWaiter;
              this.entryWaiter = null;
              resolve(entry);
            } else {
              this.queue.push(entry);
            }
          }
        } else if (msg.type === "channel_ack_confirm") {
          const confirm = msg as unknown as { cursor: number };
          for (const [cursor, resolve] of this.ackResolvers) {
            if (cursor <= confirm.cursor) {
              resolve();
              this.ackResolvers.delete(cursor);
            }
          }
        }
      }
    };

    ws.onclose = () => {
      for (const [, resolve] of this.ackResolvers) {
        resolve();
      }
      this.ackResolvers.clear();

      if (!this.closed) {
        setTimeout(() => this.connect(), RECONNECT_MS);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    this.ws = ws;
  }

  async next(): Promise<OutboxEntry | null> {
    if (this.closed) return null;
    const entry = this.queue.shift();
    if (entry) return entry;
    return new Promise((resolve) => {
      this.entryWaiter = resolve;
    });
  }

  ack(cursor: number): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "channel_ack", cursor }));
    }
    return new Promise((resolve) => {
      this.ackResolvers.set(cursor, resolve);
    });
  }

  close(): void {
    this.closed = true;
    if (this.entryWaiter) {
      this.entryWaiter(null);
      this.entryWaiter = null;
    }
    this.ws?.close();
  }
}

export async function startChannelWorker(
  hubUrl: string,
  channelId: string,
  instance: ChannelInstance,
  maxUnacked: number = DEFAULT_MAX_UNACKED,
): Promise<void> {
  const wsUrl = `${hubUrl.replace(/^http/, "ws")}/channel-api/ws`;
  const consumer = new WebSocketConsumer(wsUrl, channelId);
  const pipeline = new Pipeline(consumer, maxUnacked);

  while (true) {
    const entry = await pipeline.next();
    if (entry === null) break;
    const payload = JSON.parse(entry.payload) as ChannelOutboxPayload;
    dispatch(instance, payload);
  }
}
