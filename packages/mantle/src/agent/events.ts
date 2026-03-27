import type { EventStore } from "../store/types.ts";

type OpenEvent = {
  id: number;
  code: string;
};

export class EventTracker {
  private store: EventStore;

  // Keys: provider
  private providerEvents = new Map<string, OpenEvent>();
  // Keys: provider:target
  private targetEvents = new Map<string, OpenEvent>();
  // Keys: provider:target:check
  private checkEvents = new Map<string, OpenEvent>();

  constructor(store: EventStore) {
    this.store = store;
  }

  async handleProviderOutcome(
    provider: string,
    time: Date,
    outcome: { code: string; message: string } | null
  ): Promise<void> {
    const key = provider;
    const open = this.providerEvents.get(key);

    if (outcome) {
      // Error occurred
      if (open && open.code === outcome.code) {
        // Same error continues, do nothing
        return;
      }
      if (open) {
        // Different error, close old one first
        await this.store.closeProviderEvent(open.id, time);
      }
      // Open new event
      const id = await this.store.openProviderEvent(
        provider,
        outcome.code,
        time,
        outcome.message
      );
      this.providerEvents.set(key, { id, code: outcome.code });
      console.log(`[${provider}] EVENT OPENED: ${outcome.code} - ${outcome.message}`);
    } else {
      // Success
      if (open) {
        await this.store.closeProviderEvent(open.id, time);
        this.providerEvents.delete(key);
        console.log(`[${provider}] EVENT CLOSED: ${open.code}`);
      }
    }
  }

  async handleTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    outcome: { code: string; message: string } | null
  ): Promise<void> {
    const key = `${provider}:${target}`;
    const open = this.targetEvents.get(key);

    if (outcome) {
      if (open && open.code === outcome.code) {
        return;
      }
      if (open) {
        await this.store.closeTargetEvent(open.id, time);
      }
      const id = await this.store.openTargetEvent(
        provider,
        target,
        outcome.code,
        time,
        outcome.message
      );
      this.targetEvents.set(key, { id, code: outcome.code });
      console.log(`[${target}] EVENT OPENED: ${outcome.code} - ${outcome.message}`);
    } else {
      if (open) {
        await this.store.closeTargetEvent(open.id, time);
        this.targetEvents.delete(key);
        console.log(`[${target}] EVENT CLOSED: ${open.code}`);
      }
    }
  }

  async handleCheckOutcome(
    provider: string,
    target: string,
    check: string,
    time: Date,
    outcome: { code: string; kind: "error" | "violation"; message: string } | null
  ): Promise<void> {
    const key = `${provider}:${target}:${check}`;
    const open = this.checkEvents.get(key);

    if (outcome) {
      if (open && open.code === outcome.code) {
        return;
      }
      if (open) {
        await this.store.closeCheckEvent(open.id, time);
      }
      const id = await this.store.openCheckEvent(
        provider,
        target,
        check,
        outcome.code,
        outcome.kind,
        time,
        outcome.message
      );
      this.checkEvents.set(key, { id, code: outcome.code });
      console.log(`[${target}] ${check} EVENT OPENED: ${outcome.code} - ${outcome.message}`);
    } else {
      if (open) {
        await this.store.closeCheckEvent(open.id, time);
        this.checkEvents.delete(key);
        console.log(`[${target}] ${check} EVENT CLOSED: ${open.code}`);
      }
    }
  }
}
