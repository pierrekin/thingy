import type { MantleSocket } from "../mantle-socket.ts";
import { Subscription } from "./base.ts";

/**
 * StateSubscription manages a client's subscription to entity state data
 * (buckets and events) for a specific time range.
 *
 * In live mode (end === null), the subscription continues to receive new
 * buckets as time advances. In historical mode, it receives the initial
 * backfill and then only updates to existing data.
 */
export class StateSubscription extends Subscription {
  constructor(
    id: string,
    ws: MantleSocket<unknown>,
    public readonly start: number,
    public readonly end: number | null,
    public readonly bucketDurationMs: number,
  ) {
    super(id, ws);
  }

  getType(): string {
    return "state";
  }

  /**
   * Check if a bucket falls within this subscription's time range
   */
  isInRange(bucketStart: number): boolean {
    if (bucketStart < this.start) {
      return false;
    }

    if (this.end !== null && bucketStart >= this.end) {
      return false;
    }

    return true;
  }

  /**
   * Check if this is a live subscription (rolling window)
   */
  isLive(): boolean {
    return this.end === null;
  }
}
