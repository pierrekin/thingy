import type { EventStore } from "../store/types.ts";
import type { EventPublisher, EventState } from "../hub/pubsub.ts";

type OpenEvent = {
  id: number;
  code: string;
  startTime: number;
  message: string;
};

export class EventTracker {
  private store: EventStore;
  private publisher: EventPublisher;

  // Keys: provider
  private providerEvents = new Map<string, OpenEvent>();
  // Keys: provider:target
  private targetEvents = new Map<string, OpenEvent>();
  // Keys: provider:target:check
  private checkEvents = new Map<string, OpenEvent>();

  constructor(store: EventStore, publisher: EventPublisher) {
    this.store = store;
    this.publisher = publisher;
  }

  async loadOpenEvents(): Promise<void> {
    const [providerEvents, targetEvents, checkEvents] = await Promise.all([
      this.store.getOpenProviderEvents(),
      this.store.getOpenTargetEvents(),
      this.store.getOpenCheckEvents(),
    ]);

    for (const e of providerEvents) {
      this.providerEvents.set(e.provider, {
        id: e.id,
        code: e.code,
        startTime: e.startTime,
        message: e.message,
      });
    }

    for (const e of targetEvents) {
      this.targetEvents.set(`${e.provider}:${e.target}`, {
        id: e.id,
        code: e.code,
        startTime: e.startTime,
        message: e.message,
      });
    }

    for (const e of checkEvents) {
      this.checkEvents.set(`${e.provider}:${e.target}:${e.check}`, {
        id: e.id,
        code: e.code,
        startTime: e.startTime,
        message: e.message,
      });
    }

    const total = providerEvents.length + targetEvents.length + checkEvents.length;
    if (total > 0) {
      console.log(`Loaded ${total} open events from database`);
    }
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
        const closedEvent: EventState = {
          id: open.id,
          provider,
          code: open.code,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        this.publisher.publish(closedEvent);
      }
      // Open new event
      const startTime = time.getTime();
      const id = await this.store.openProviderEvent(
        provider,
        outcome.code,
        time,
        outcome.message
      );
      this.providerEvents.set(key, { id, code: outcome.code, startTime, message: outcome.message });
      const openedEvent: EventState = {
        id,
        provider,
        code: outcome.code,
        startTime,
        endTime: null,
        message: outcome.message,
      };
      this.publisher.publish(openedEvent);
      console.log(`[${provider}] EVENT OPENED: ${outcome.code} - ${outcome.message}`);
    } else {
      // Success
      if (open) {
        await this.store.closeProviderEvent(open.id, time);
        const closedEvent: EventState = {
          id: open.id,
          provider,
          code: open.code,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        this.publisher.publish(closedEvent);
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
        const closedEvent: EventState = {
          id: open.id,
          provider,
          target,
          code: open.code,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        this.publisher.publish(closedEvent);
      }
      const startTime = time.getTime();
      const id = await this.store.openTargetEvent(
        provider,
        target,
        outcome.code,
        time,
        outcome.message
      );
      this.targetEvents.set(key, { id, code: outcome.code, startTime, message: outcome.message });
      const openedEvent: EventState = {
        id,
        provider,
        target,
        code: outcome.code,
        startTime,
        endTime: null,
        message: outcome.message,
      };
      this.publisher.publish(openedEvent);
      console.log(`[${target}] EVENT OPENED: ${outcome.code} - ${outcome.message}`);
    } else {
      if (open) {
        await this.store.closeTargetEvent(open.id, time);
        const closedEvent: EventState = {
          id: open.id,
          provider,
          target,
          code: open.code,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        this.publisher.publish(closedEvent);
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
        const closedEvent: EventState = {
          id: open.id,
          provider,
          target,
          check,
          code: open.code,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        this.publisher.publish(closedEvent);
      }
      const startTime = time.getTime();
      const id = await this.store.openCheckEvent(
        provider,
        target,
        check,
        outcome.code,
        outcome.kind,
        time,
        outcome.message
      );
      this.checkEvents.set(key, { id, code: outcome.code, startTime, message: outcome.message });
      const openedEvent: EventState = {
        id,
        provider,
        target,
        check,
        code: outcome.code,
        startTime,
        endTime: null,
        message: outcome.message,
      };
      this.publisher.publish(openedEvent);
      console.log(`[${target}] ${check} EVENT OPENED: ${outcome.code} - ${outcome.message}`);
    } else {
      if (open) {
        await this.store.closeCheckEvent(open.id, time);
        const closedEvent: EventState = {
          id: open.id,
          provider,
          target,
          check,
          code: open.code,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        this.publisher.publish(closedEvent);
        this.checkEvents.delete(key);
        console.log(`[${target}] ${check} EVENT CLOSED: ${open.code}`);
      }
    }
  }
}
