import type {
  CheckEventEndedRecord,
  CheckEventRecord,
  EventStore,
  OutboxStore,
  ProviderEventEndedRecord,
  ProviderEventRecord,
  TargetEventEndedRecord,
  TargetEventRecord,
} from "mantle-store";
import type { ChannelOutboxPayload } from "./channel-outbox.ts";
import type {
  CheckEventPublisher,
  ProviderEventPublisher,
  TargetEventPublisher,
} from "./pubsub.ts";

type OpenEvent = {
  id: number;
  code: string;
  title: string;
  startTime: number;
  message: string;
};

type EventPublishers = {
  provider: ProviderEventPublisher;
  target: TargetEventPublisher;
  check: CheckEventPublisher;
};

export class EventTracker {
  private store: EventStore;
  private publishers: EventPublishers;

  // Keys: provider
  private providerEvents = new Map<string, OpenEvent>();
  // Keys: provider:target
  private targetEvents = new Map<string, OpenEvent>();
  // Keys: provider:target:check
  private checkEvents = new Map<string, OpenEvent>();

  constructor(
    store: EventStore,
    publishers: EventPublishers,
    private channelOutbox?: OutboxStore,
  ) {
    this.store = store;
    this.publishers = publishers;
  }

  private async appendToChannelOutbox(
    payload: ChannelOutboxPayload,
  ): Promise<void> {
    if (this.channelOutbox) {
      await this.channelOutbox.append(JSON.stringify(payload));
    }
  }

  getOpenProviderEventId(provider: string): number | undefined {
    return this.providerEvents.get(provider)?.id;
  }

  getOpenTargetEventId(provider: string, target: string): number | undefined {
    return this.targetEvents.get(`${provider}:${target}`)?.id;
  }

  getOpenCheckEventId(
    provider: string,
    target: string,
    check: string,
  ): number | undefined {
    return this.checkEvents.get(`${provider}:${target}:${check}`)?.id;
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
        title: e.title,
        startTime: e.startTime,
        message: e.message,
      });
    }

    for (const e of targetEvents) {
      this.targetEvents.set(`${e.provider}:${e.target}`, {
        id: e.id,
        code: e.code,
        title: e.title,
        startTime: e.startTime,
        message: e.message,
      });
    }

    for (const e of checkEvents) {
      this.checkEvents.set(`${e.provider}:${e.target}:${e.check}`, {
        id: e.id,
        code: e.code,
        title: e.title,
        startTime: e.startTime,
        message: e.message,
      });
    }

    const total =
      providerEvents.length + targetEvents.length + checkEvents.length;
    if (total > 0) {
      console.log(`Loaded ${total} open events from database`);
    }
  }

  async handleProviderOutcome(
    provider: string,
    time: Date,
    outcome: { code: string; title: string; message: string } | null,
  ): Promise<void> {
    const key = provider;
    const open = this.providerEvents.get(key);

    if (outcome) {
      if (open && open.code === outcome.code) {
        return;
      }
      if (open) {
        await this.store.closeProviderEvent(open.id, time);
        const closedEvent: ProviderEventEndedRecord = {
          id: open.id,
          provider,
          code: open.code,
          title: open.title,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        await this.appendToChannelOutbox({
          type: "provider_event_ended",
          event: closedEvent,
        });
        this.publishers.provider.publish(closedEvent);
      }
      const startTime = time.getTime();
      const id = await this.store.openProviderEvent(
        provider,
        outcome.code,
        outcome.title,
        time,
        outcome.message,
      );
      this.providerEvents.set(key, {
        id,
        code: outcome.code,
        title: outcome.title,
        startTime,
        message: outcome.message,
      });
      const openedEvent: ProviderEventRecord = {
        id,
        provider,
        code: outcome.code,
        title: outcome.title,
        startTime,
        endTime: null,
        message: outcome.message,
      };
      await this.appendToChannelOutbox({
        type: "provider_event_started",
        event: openedEvent,
      });
      this.publishers.provider.publish(openedEvent);
      console.log(
        `[${provider}] EVENT OPENED: ${outcome.code} - ${outcome.title}`,
      );
    } else {
      if (open) {
        await this.store.closeProviderEvent(open.id, time);
        const closedEvent: ProviderEventEndedRecord = {
          id: open.id,
          provider,
          code: open.code,
          title: open.title,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        await this.appendToChannelOutbox({
          type: "provider_event_ended",
          event: closedEvent,
        });
        this.publishers.provider.publish(closedEvent);
        this.providerEvents.delete(key);
        console.log(`[${provider}] EVENT CLOSED: ${open.code}`);
      }
    }
  }

  async handleTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    outcome: { code: string; title: string; message: string } | null,
  ): Promise<void> {
    const key = `${provider}:${target}`;
    const open = this.targetEvents.get(key);

    if (outcome) {
      if (open && open.code === outcome.code) {
        return;
      }
      if (open) {
        await this.store.closeTargetEvent(open.id, time);
        const closedEvent: TargetEventEndedRecord = {
          id: open.id,
          provider,
          target,
          code: open.code,
          title: open.title,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        await this.appendToChannelOutbox({
          type: "target_event_ended",
          event: closedEvent,
        });
        this.publishers.target.publish(closedEvent);
      }
      const startTime = time.getTime();
      const id = await this.store.openTargetEvent(
        provider,
        target,
        outcome.code,
        outcome.title,
        time,
        outcome.message,
      );
      this.targetEvents.set(key, {
        id,
        code: outcome.code,
        title: outcome.title,
        startTime,
        message: outcome.message,
      });
      const openedEvent: TargetEventRecord = {
        id,
        provider,
        target,
        code: outcome.code,
        title: outcome.title,
        startTime,
        endTime: null,
        message: outcome.message,
      };
      await this.appendToChannelOutbox({
        type: "target_event_started",
        event: openedEvent,
      });
      this.publishers.target.publish(openedEvent);
      console.log(
        `[${target}] EVENT OPENED: ${outcome.code} - ${outcome.title}`,
      );
    } else {
      if (open) {
        await this.store.closeTargetEvent(open.id, time);
        const closedEvent: TargetEventEndedRecord = {
          id: open.id,
          provider,
          target,
          code: open.code,
          title: open.title,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        await this.appendToChannelOutbox({
          type: "target_event_ended",
          event: closedEvent,
        });
        this.publishers.target.publish(closedEvent);
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
    outcome: {
      code: string;
      title: string;
      kind: "error" | "violation";
      message: string;
    } | null,
  ): Promise<void> {
    const key = `${provider}:${target}:${check}`;
    const open = this.checkEvents.get(key);

    if (outcome) {
      if (open && open.code === outcome.code) {
        return;
      }
      if (open) {
        await this.store.closeCheckEvent(open.id, time);
        const closedEvent: CheckEventEndedRecord = {
          id: open.id,
          provider,
          target,
          check,
          code: open.code,
          title: open.title,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        await this.appendToChannelOutbox({
          type: "check_event_ended",
          event: closedEvent,
        });
        this.publishers.check.publish(closedEvent);
      }
      const startTime = time.getTime();
      const id = await this.store.openCheckEvent(
        provider,
        target,
        check,
        outcome.code,
        outcome.title,
        outcome.kind,
        time,
        outcome.message,
      );
      this.checkEvents.set(key, {
        id,
        code: outcome.code,
        title: outcome.title,
        startTime,
        message: outcome.message,
      });
      const openedEvent: CheckEventRecord = {
        id,
        provider,
        target,
        check,
        code: outcome.code,
        title: outcome.title,
        startTime,
        endTime: null,
        message: outcome.message,
      };
      await this.appendToChannelOutbox({
        type: "check_event_started",
        event: openedEvent,
      });
      this.publishers.check.publish(openedEvent);
      console.log(
        `[${target}] ${check} EVENT OPENED: ${outcome.code} - ${outcome.title}`,
      );
    } else {
      if (open) {
        await this.store.closeCheckEvent(open.id, time);
        const closedEvent: CheckEventEndedRecord = {
          id: open.id,
          provider,
          target,
          check,
          code: open.code,
          title: open.title,
          startTime: open.startTime,
          endTime: time.getTime(),
          message: open.message,
        };
        await this.appendToChannelOutbox({
          type: "check_event_ended",
          event: closedEvent,
        });
        this.publishers.check.publish(closedEvent);
        this.checkEvents.delete(key);
        console.log(`[${target}] ${check} EVENT CLOSED: ${open.code}`);
      }
    }
  }
}
