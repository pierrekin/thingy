import type { MantleSocket } from "../mantle-socket.ts";

/**
 * Base class for all subscription types.
 * Manages lifecycle and cleanup of real-time data subscriptions.
 */
export abstract class Subscription {
  protected unsubscribers: (() => void)[] = [];

  constructor(
    public readonly id: string,
    public readonly ws: MantleSocket<unknown>,
  ) {}

  /**
   * Add an unsubscribe callback to be called during cleanup
   */
  addUnsubscriber(fn: () => void): void {
    this.unsubscribers.push(fn);
  }

  /**
   * Clean up all subscriptions and resources
   */
  cleanup(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  /**
   * Get the subscription type for logging/debugging
   */
  abstract getType(): string;
}
