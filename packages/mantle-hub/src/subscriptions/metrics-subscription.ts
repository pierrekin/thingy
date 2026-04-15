import type { MantleSocket } from "../mantle-socket.ts";
import { Subscription } from "./base.ts";

export class MetricsSubscription extends Subscription {
  constructor(
    id: string,
    ws: MantleSocket<unknown>,
    public readonly provider: string,
    public readonly target: string,
    public readonly check: string,
    public readonly start: number,
    public readonly end: number | null,
    public readonly bucketDurationMs: number,
  ) {
    super(id, ws);
  }

  getType(): string {
    return "metrics";
  }

  matches(provider: string, target: string, check: string): boolean {
    return this.provider === provider &&
           this.target === target &&
           this.check === check;
  }

  isInRange(bucketStart: number): boolean {
    if (bucketStart < this.start) return false;
    if (this.end !== null && bucketStart >= this.end) return false;
    return true;
  }

  isLive(): boolean {
    return this.end === null;
  }
}
