import type { OutboxEntry, OutboxStore } from "mantle-store";
import type { MantleSocket } from "./mantle-socket.ts";

const MAX_IN_FLIGHT = 100;
const ACTIVE_INTERVAL_MS = 50;
const IDLE_INTERVAL_MS = 2000;

type SinkBatchMessage = {
  type: "sink_batch";
  entries: OutboxEntry[];
};

class SinkSession {
  private committedCursor: number | null = null;
  private sentCursor: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  constructor(
    private ws: MantleSocket<unknown>,
    private sinkId: string,
    private outbox: OutboxStore,
  ) {}

  async start(): Promise<void> {
    this.committedCursor = await this.outbox.getCursor(this.sinkId);
    this.sentCursor = this.committedCursor;
    await this.tick();
    this.startTimer();
  }

  async handleAck(cursor: number): Promise<void> {
    this.committedCursor = cursor;
    await this.outbox.advanceCursor(this.sinkId, cursor);
    this.ws.send(JSON.stringify({ type: "sink_ack_confirm", cursor }));
    if (!this.active) {
      this.active = true;
      this.restartTimer();
    }
  }

  cleanup(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startTimer(): void {
    if (this.timer !== null) return;
    const interval = this.active ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
  }

  private restartTimer(): void {
    this.cleanup();
    this.startTimer();
  }

  private async tick(): Promise<void> {
    const inFlight = (this.sentCursor ?? 0) - (this.committedCursor ?? 0);
    const toSend = MAX_IN_FLIGHT - inFlight;
    if (toSend <= 0) return;

    const entries = await this.outbox.read(this.sentCursor, toSend);
    const last = entries.at(-1);

    if (last) {
      this.sentCursor = last.id;
      const msg: SinkBatchMessage = { type: "sink_batch", entries };
      this.ws.send(JSON.stringify(msg));

      if (!this.active) {
        this.active = true;
        this.restartTimer();
      }
    } else if (inFlight === 0 && this.active) {
      this.active = false;
      this.restartTimer();
    }
  }
}

export class SinkSessionManager {
  private sessions = new Map<MantleSocket<unknown>, SinkSession>();

  constructor(private outbox: OutboxStore) {}

  async handleHello(ws: MantleSocket<unknown>, sinkId: string): Promise<void> {
    const existing = this.sessions.get(ws);
    if (existing) existing.cleanup();
    const session = new SinkSession(ws, sinkId, this.outbox);
    this.sessions.set(ws, session);
    await session.start();
  }

  async handleAck(ws: MantleSocket<unknown>, cursor: number): Promise<void> {
    const session = this.sessions.get(ws);
    if (session) await session.handleAck(cursor);
  }

  handleDisconnect(ws: MantleSocket<unknown>): void {
    const session = this.sessions.get(ws);
    if (session) {
      session.cleanup();
      this.sessions.delete(ws);
    }
  }
}
