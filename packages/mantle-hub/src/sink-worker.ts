import type { SinkInstance, SinkRecord } from "mantle-framework";
import type { OutboxEntry } from "mantle-store";
import { Batch, type OutboxConsumer } from "./outbox-consumer.ts";

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_LINGER_MS = 1000;
const RECONNECT_MS = 2000;

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
      ws.send(JSON.stringify({ type: "sink_hello", sinkId: this.workerId }));
    };

    ws.onmessage = (event) => {
      const lines = (event.data as string).split("\n");
      for (const line of lines) {
        if (!line) continue;
        const msg = JSON.parse(line) as { type: string };

        if (msg.type === "sink_batch") {
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
        } else if (msg.type === "sink_ack_confirm") {
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
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    return new Promise((resolve) => {
      this.entryWaiter = resolve;
    });
  }

  ack(cursor: number): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "sink_ack", cursor }));
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

export async function startSinkWorker(
  hubUrl: string,
  sinkId: string,
  instance: SinkInstance,
  batchSize: number = DEFAULT_BATCH_SIZE,
  lingerMs: number = DEFAULT_LINGER_MS,
): Promise<void> {
  const wsUrl = `${hubUrl.replace(/^http/, "ws")}/sink-api/ws`;
  const consumer = new WebSocketConsumer(wsUrl, sinkId);
  const batch = new Batch(consumer, batchSize, lingerMs);

  while (true) {
    const entries = await batch.next();
    if (entries === null) break;
    const records: SinkRecord[] = entries.map(
      (e) => JSON.parse(e.payload) as SinkRecord,
    );
    await instance.write(records);
  }
}
