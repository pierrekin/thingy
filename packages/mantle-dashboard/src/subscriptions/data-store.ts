import type {
  AgentBucketMessage,
  AgentEventMessage,
  AgentInstanceInfo,
  ChannelBucketMessage,
  ChannelEventMessage,
  CheckBucketMessage,
  CheckEventMessage,
  MetricsBucketMessage,
  ProviderBucketMessage,
  ProviderEventMessage,
  TargetBucketMessage,
  TargetEventMessage,
} from "@mantle-team/client";
import { create } from "zustand";

/**
 * Raw bucket data without the subscription metadata
 */
type BucketData = {
  bucketStart: number;
  bucketEnd: number;
  status: "green" | "red" | "grey" | null;
};

/**
 * Raw metrics bucket data
 */
type MetricsBucketData = {
  bucketStart: number;
  bucketEnd: number;
  mean: number | null;
};

/**
 * Raw event data
 */
type ProviderEvent = {
  id: number;
  provider: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

type TargetEvent = {
  id: number;
  provider: string;
  target: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

type CheckEvent = {
  id: number;
  provider: string;
  target: string;
  check: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

type ChannelEvent = {
  id: number;
  channel: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

type AgentEvent = {
  id: number;
  agent: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

/**
 * The Zustand store state
 */
interface DataStoreState {
  // Buckets organized by: subscriptionId -> entityKey -> bucketStart -> data
  providerBuckets: Map<string, Map<string, Map<number, BucketData>>>;
  targetBuckets: Map<string, Map<string, Map<number, BucketData>>>;
  checkBuckets: Map<string, Map<string, Map<number, BucketData>>>;
  channelBuckets: Map<string, Map<string, Map<number, BucketData>>>;
  agentBuckets: Map<string, Map<string, Map<number, BucketData>>>;

  // Metrics buckets organized by: subscriptionId -> entityKey -> bucketStart -> data
  metricsBuckets: Map<string, Map<string, Map<number, MetricsBucketData>>>;

  // Events organized by: subscriptionId -> eventId -> data
  providerEvents: Map<string, Map<number, ProviderEvent>>;
  targetEvents: Map<string, Map<number, TargetEvent>>;
  checkEvents: Map<string, Map<number, CheckEvent>>;
  channelEvents: Map<string, Map<number, ChannelEvent>>;
  agentEvents: Map<string, Map<number, AgentEvent>>;

  // Latest statuses
  providerStatuses: Map<string, "green" | "red" | "grey" | null>;
  targetStatuses: Map<string, "green" | "red" | "grey" | null>;
  channelStatuses: Map<string, "green" | "red" | "grey" | null>;
  agentStatuses: Map<string, "green" | "red" | "grey" | null>;

  // Agent instances (live connection state, agentId -> instances)
  agentInstances: Map<string, AgentInstanceInfo[]>;

  // Event subscription data
  eventInfo: Map<
    string,
    { title: string; code: string; startTime: number; endTime: number | null }
  >;
  eventOutcomes: Map<
    string,
    Array<{
      id: number;
      time: number;
      error: string | null;
      violation: string | null;
    }>
  >;

  // Actions
  addProviderBucket: (msg: ProviderBucketMessage) => void;
  addTargetBucket: (msg: TargetBucketMessage) => void;
  addCheckBucket: (msg: CheckBucketMessage) => void;
  addChannelBucket: (msg: ChannelBucketMessage) => void;
  addAgentBucket: (msg: AgentBucketMessage) => void;
  addMetricsBucket: (msg: MetricsBucketMessage) => void;
  addProviderEvent: (msg: ProviderEventMessage) => void;
  addTargetEvent: (msg: TargetEventMessage) => void;
  addCheckEvent: (msg: CheckEventMessage) => void;
  addChannelEvent: (msg: ChannelEventMessage) => void;
  addAgentEvent: (msg: AgentEventMessage) => void;
  setProviderStatus: (msg: {
    provider: string;
    status: "green" | "red" | "grey" | null;
  }) => void;
  setTargetStatus: (msg: {
    provider: string;
    target: string;
    status: "green" | "red" | "grey" | null;
  }) => void;
  setChannelStatus: (msg: {
    channel: string;
    status: "green" | "red" | "grey" | null;
  }) => void;
  setAgentStatus: (msg: {
    agent: string;
    status: "green" | "red" | "grey" | null;
  }) => void;
  setAgentInstances: (msg: {
    agent: string;
    instances: AgentInstanceInfo[];
  }) => void;
  setEventInfo: (msg: {
    subscriptionId: string;
    title: string;
    code: string;
    startTime: number;
    endTime: number | null;
  }) => void;
  addEventOutcome: (msg: {
    subscriptionId: string;
    id: number;
    time: number;
    error: string | null;
    violation: string | null;
  }) => void;
  clearSubscription: (subscriptionId: string) => void;
  gcBuckets: (subscriptionId: string, keepCount: number) => void;
}

/**
 * SubscriptionDataStore manages raw data received from the backend using Zustand.
 * This is Layer 1: complete dataset storage, not filtered for display.
 *
 * Data is organized by subscription ID, allowing multiple subscriptions
 * (e.g., different time ranges) to coexist without conflict.
 */
export const useDataStore = create<DataStoreState>((set) => ({
  providerBuckets: new Map(),
  targetBuckets: new Map(),
  checkBuckets: new Map(),
  channelBuckets: new Map(),
  agentBuckets: new Map(),
  metricsBuckets: new Map(),
  providerEvents: new Map(),
  targetEvents: new Map(),
  checkEvents: new Map(),
  channelEvents: new Map(),
  agentEvents: new Map(),
  providerStatuses: new Map(),
  targetStatuses: new Map(),
  channelStatuses: new Map(),
  agentStatuses: new Map(),
  agentInstances: new Map(),
  eventInfo: new Map(),
  eventOutcomes: new Map(),

  addProviderBucket: (msg: ProviderBucketMessage) => {
    set((state) => {
      const providerBuckets = new Map(state.providerBuckets);
      const subBuckets = new Map(
        providerBuckets.get(msg.subscriptionId) ?? new Map(),
      );
      const entityBuckets = new Map(subBuckets.get(msg.provider) ?? new Map());

      entityBuckets.set(msg.bucketStart, {
        bucketStart: msg.bucketStart,
        bucketEnd: msg.bucketEnd,
        status: msg.status,
      });

      subBuckets.set(msg.provider, entityBuckets);
      providerBuckets.set(msg.subscriptionId, subBuckets);

      return { providerBuckets };
    });
  },

  addTargetBucket: (msg: TargetBucketMessage) => {
    set((state) => {
      const key = `${msg.provider}/${msg.target}`;
      const targetBuckets = new Map(state.targetBuckets);
      const subBuckets = new Map(
        targetBuckets.get(msg.subscriptionId) ?? new Map(),
      );
      const entityBuckets = new Map(subBuckets.get(key) ?? new Map());

      entityBuckets.set(msg.bucketStart, {
        bucketStart: msg.bucketStart,
        bucketEnd: msg.bucketEnd,
        status: msg.status,
      });

      subBuckets.set(key, entityBuckets);
      targetBuckets.set(msg.subscriptionId, subBuckets);

      return { targetBuckets };
    });
  },

  addCheckBucket: (msg: CheckBucketMessage) => {
    set((state) => {
      const key = `${msg.provider}/${msg.target}/${msg.check}`;
      const checkBuckets = new Map(state.checkBuckets);
      const subBuckets = new Map(
        checkBuckets.get(msg.subscriptionId) ?? new Map(),
      );
      const entityBuckets = new Map(subBuckets.get(key) ?? new Map());

      entityBuckets.set(msg.bucketStart, {
        bucketStart: msg.bucketStart,
        bucketEnd: msg.bucketEnd,
        status: msg.status,
      });

      subBuckets.set(key, entityBuckets);
      checkBuckets.set(msg.subscriptionId, subBuckets);

      return { checkBuckets };
    });
  },

  addChannelBucket: (msg: ChannelBucketMessage) => {
    set((state) => {
      const channelBuckets = new Map(state.channelBuckets);
      const subBuckets = new Map(
        channelBuckets.get(msg.subscriptionId) ?? new Map(),
      );
      const entityBuckets = new Map(subBuckets.get(msg.channel) ?? new Map());

      entityBuckets.set(msg.bucketStart, {
        bucketStart: msg.bucketStart,
        bucketEnd: msg.bucketEnd,
        status: msg.status,
      });

      subBuckets.set(msg.channel, entityBuckets);
      channelBuckets.set(msg.subscriptionId, subBuckets);

      return { channelBuckets };
    });
  },

  addAgentBucket: (msg: AgentBucketMessage) => {
    set((state) => {
      const agentBuckets = new Map(state.agentBuckets);
      const subBuckets = new Map(
        agentBuckets.get(msg.subscriptionId) ?? new Map(),
      );
      const entityBuckets = new Map(subBuckets.get(msg.agent) ?? new Map());

      entityBuckets.set(msg.bucketStart, {
        bucketStart: msg.bucketStart,
        bucketEnd: msg.bucketEnd,
        status: msg.status,
      });

      subBuckets.set(msg.agent, entityBuckets);
      agentBuckets.set(msg.subscriptionId, subBuckets);

      return { agentBuckets };
    });
  },

  addMetricsBucket: (msg: MetricsBucketMessage) => {
    set((state) => {
      const key = `${msg.provider}/${msg.target}/${msg.check}`;
      const metricsBuckets = new Map(state.metricsBuckets);
      const subBuckets = new Map(
        metricsBuckets.get(msg.subscriptionId) ?? new Map(),
      );
      const entityBuckets = new Map(subBuckets.get(key) ?? new Map());

      entityBuckets.set(msg.bucketStart, {
        bucketStart: msg.bucketStart,
        bucketEnd: msg.bucketEnd,
        mean: msg.mean,
      });

      subBuckets.set(key, entityBuckets);
      metricsBuckets.set(msg.subscriptionId, subBuckets);

      return { metricsBuckets };
    });
  },

  addProviderEvent: (msg: ProviderEventMessage) => {
    set((state) => {
      const providerEvents = new Map(state.providerEvents);
      const subEvents = new Map(
        providerEvents.get(msg.subscriptionId) ?? new Map(),
      );
      subEvents.set(msg.id, {
        id: msg.id,
        provider: msg.provider,
        code: msg.code,
        title: msg.title,
        startTime: msg.startTime,
        endTime: msg.endTime,
        message: msg.message,
      });
      providerEvents.set(msg.subscriptionId, subEvents);
      return { providerEvents };
    });
  },

  addTargetEvent: (msg: TargetEventMessage) => {
    set((state) => {
      const targetEvents = new Map(state.targetEvents);
      const subEvents = new Map(
        targetEvents.get(msg.subscriptionId) ?? new Map(),
      );
      subEvents.set(msg.id, {
        id: msg.id,
        provider: msg.provider,
        target: msg.target,
        code: msg.code,
        title: msg.title,
        startTime: msg.startTime,
        endTime: msg.endTime,
        message: msg.message,
      });
      targetEvents.set(msg.subscriptionId, subEvents);
      return { targetEvents };
    });
  },

  addCheckEvent: (msg: CheckEventMessage) => {
    set((state) => {
      const checkEvents = new Map(state.checkEvents);
      const subEvents = new Map(
        checkEvents.get(msg.subscriptionId) ?? new Map(),
      );
      subEvents.set(msg.id, {
        id: msg.id,
        provider: msg.provider,
        target: msg.target,
        check: msg.check,
        code: msg.code,
        title: msg.title,
        startTime: msg.startTime,
        endTime: msg.endTime,
        message: msg.message,
      });
      checkEvents.set(msg.subscriptionId, subEvents);
      return { checkEvents };
    });
  },

  addChannelEvent: (msg: ChannelEventMessage) => {
    set((state) => {
      const channelEvents = new Map(state.channelEvents);
      const subEvents = new Map(
        channelEvents.get(msg.subscriptionId) ?? new Map(),
      );
      subEvents.set(msg.id, {
        id: msg.id,
        channel: msg.channel,
        code: msg.code,
        title: msg.title,
        startTime: msg.startTime,
        endTime: msg.endTime,
        message: msg.message,
      });
      channelEvents.set(msg.subscriptionId, subEvents);
      return { channelEvents };
    });
  },

  addAgentEvent: (msg: AgentEventMessage) => {
    set((state) => {
      const agentEvents = new Map(state.agentEvents);
      const subEvents = new Map(
        agentEvents.get(msg.subscriptionId) ?? new Map(),
      );
      subEvents.set(msg.id, {
        id: msg.id,
        agent: msg.agent,
        code: msg.code,
        title: msg.title,
        startTime: msg.startTime,
        endTime: msg.endTime,
        message: msg.message,
      });
      agentEvents.set(msg.subscriptionId, subEvents);
      return { agentEvents };
    });
  },

  setProviderStatus: (msg) => {
    set((state) => {
      const providerStatuses = new Map(state.providerStatuses);
      providerStatuses.set(msg.provider, msg.status);
      return { providerStatuses };
    });
  },

  setTargetStatus: (msg) => {
    set((state) => {
      const targetStatuses = new Map(state.targetStatuses);
      targetStatuses.set(`${msg.provider}/${msg.target}`, msg.status);
      return { targetStatuses };
    });
  },

  setChannelStatus: (msg) => {
    set((state) => {
      const channelStatuses = new Map(state.channelStatuses);
      channelStatuses.set(msg.channel, msg.status);
      return { channelStatuses };
    });
  },

  setAgentStatus: (msg) => {
    set((state) => {
      const agentStatuses = new Map(state.agentStatuses);
      agentStatuses.set(msg.agent, msg.status);
      return { agentStatuses };
    });
  },

  setAgentInstances: (msg) => {
    set((state) => {
      const agentInstances = new Map(state.agentInstances);
      if (msg.instances.length === 0) {
        agentInstances.delete(msg.agent);
      } else {
        agentInstances.set(msg.agent, msg.instances);
      }
      return { agentInstances };
    });
  },

  setEventInfo: (msg) => {
    set((state) => {
      const eventInfo = new Map(state.eventInfo);
      eventInfo.set(msg.subscriptionId, {
        title: msg.title,
        code: msg.code,
        startTime: msg.startTime,
        endTime: msg.endTime,
      });
      return { eventInfo };
    });
  },

  addEventOutcome: (msg) => {
    set((state) => {
      const eventOutcomes = new Map(state.eventOutcomes);
      const outcomes = [...(eventOutcomes.get(msg.subscriptionId) ?? [])];
      outcomes.push({
        id: msg.id,
        time: msg.time,
        error: msg.error,
        violation: msg.violation,
      });
      eventOutcomes.set(msg.subscriptionId, outcomes);
      return { eventOutcomes };
    });
  },

  clearSubscription: (subscriptionId: string) => {
    set((state) => {
      const providerBuckets = new Map(state.providerBuckets);
      const targetBuckets = new Map(state.targetBuckets);
      const checkBuckets = new Map(state.checkBuckets);
      const channelBuckets = new Map(state.channelBuckets);
      const metricsBuckets = new Map(state.metricsBuckets);
      const providerEvents = new Map(state.providerEvents);
      const targetEvents = new Map(state.targetEvents);
      const checkEvents = new Map(state.checkEvents);
      const channelEvents = new Map(state.channelEvents);
      const agentBuckets = new Map(state.agentBuckets);
      const agentEvents = new Map(state.agentEvents);
      const eventInfo = new Map(state.eventInfo);
      const eventOutcomes = new Map(state.eventOutcomes);

      providerBuckets.delete(subscriptionId);
      targetBuckets.delete(subscriptionId);
      checkBuckets.delete(subscriptionId);
      channelBuckets.delete(subscriptionId);
      metricsBuckets.delete(subscriptionId);
      providerEvents.delete(subscriptionId);
      targetEvents.delete(subscriptionId);
      checkEvents.delete(subscriptionId);
      channelEvents.delete(subscriptionId);
      agentBuckets.delete(subscriptionId);
      agentEvents.delete(subscriptionId);
      eventInfo.delete(subscriptionId);
      eventOutcomes.delete(subscriptionId);

      return {
        providerBuckets,
        targetBuckets,
        checkBuckets,
        channelBuckets,
        metricsBuckets,
        providerEvents,
        targetEvents,
        checkEvents,
        channelEvents,
        agentBuckets,
        agentEvents,
        eventInfo,
        eventOutcomes,
      };
    });
  },

  gcBuckets: (subscriptionId: string, keepCount: number) => {
    set((state) => {
      const providerBuckets = new Map(state.providerBuckets);
      const targetBuckets = new Map(state.targetBuckets);
      const checkBuckets = new Map(state.checkBuckets);
      const channelBuckets = new Map(state.channelBuckets);
      const agentBuckets = new Map(state.agentBuckets);

      // GC provider buckets
      const subProviderBuckets = providerBuckets.get(subscriptionId);
      if (subProviderBuckets) {
        const newSubProviderBuckets = new Map(subProviderBuckets);
        for (const [provider, buckets] of newSubProviderBuckets) {
          if (buckets.size > keepCount * 2) {
            const sorted = Array.from(buckets.entries()).sort(
              (a, b) => a[0] - b[0],
            );
            const toKeep = sorted.slice(-keepCount);
            newSubProviderBuckets.set(provider, new Map(toKeep));
          }
        }
        providerBuckets.set(subscriptionId, newSubProviderBuckets);
      }

      // GC target buckets
      const subTargetBuckets = targetBuckets.get(subscriptionId);
      if (subTargetBuckets) {
        const newSubTargetBuckets = new Map(subTargetBuckets);
        for (const [key, buckets] of newSubTargetBuckets) {
          if (buckets.size > keepCount * 2) {
            const sorted = Array.from(buckets.entries()).sort(
              (a, b) => a[0] - b[0],
            );
            const toKeep = sorted.slice(-keepCount);
            newSubTargetBuckets.set(key, new Map(toKeep));
          }
        }
        targetBuckets.set(subscriptionId, newSubTargetBuckets);
      }

      // GC check buckets
      const subCheckBuckets = checkBuckets.get(subscriptionId);
      if (subCheckBuckets) {
        const newSubCheckBuckets = new Map(subCheckBuckets);
        for (const [key, buckets] of newSubCheckBuckets) {
          if (buckets.size > keepCount * 2) {
            const sorted = Array.from(buckets.entries()).sort(
              (a, b) => a[0] - b[0],
            );
            const toKeep = sorted.slice(-keepCount);
            newSubCheckBuckets.set(key, new Map(toKeep));
          }
        }
        checkBuckets.set(subscriptionId, newSubCheckBuckets);
      }

      // GC channel buckets
      const subChannelBuckets = channelBuckets.get(subscriptionId);
      if (subChannelBuckets) {
        const newSubChannelBuckets = new Map(subChannelBuckets);
        for (const [key, buckets] of newSubChannelBuckets) {
          if (buckets.size > keepCount * 2) {
            const sorted = Array.from(buckets.entries()).sort(
              (a, b) => a[0] - b[0],
            );
            const toKeep = sorted.slice(-keepCount);
            newSubChannelBuckets.set(key, new Map(toKeep));
          }
        }
        channelBuckets.set(subscriptionId, newSubChannelBuckets);
      }

      // GC agent buckets
      const subAgentBuckets = agentBuckets.get(subscriptionId);
      if (subAgentBuckets) {
        const newSubAgentBuckets = new Map(subAgentBuckets);
        for (const [key, buckets] of newSubAgentBuckets) {
          if (buckets.size > keepCount * 2) {
            const sorted = Array.from(buckets.entries()).sort(
              (a, b) => a[0] - b[0],
            );
            const toKeep = sorted.slice(-keepCount);
            newSubAgentBuckets.set(key, new Map(toKeep));
          }
        }
        agentBuckets.set(subscriptionId, newSubAgentBuckets);
      }

      return {
        providerBuckets,
        targetBuckets,
        checkBuckets,
        channelBuckets,
        agentBuckets,
      };
    });
  },
}));

// Export getter functions for backward compatibility if needed
export const getProviderBuckets = (subscriptionId: string) =>
  useDataStore.getState().providerBuckets.get(subscriptionId) ?? new Map();

export const getTargetBuckets = (subscriptionId: string) =>
  useDataStore.getState().targetBuckets.get(subscriptionId) ?? new Map();

export const getCheckBuckets = (subscriptionId: string) =>
  useDataStore.getState().checkBuckets.get(subscriptionId) ?? new Map();

export const getMetricsBuckets = (subscriptionId: string) =>
  useDataStore.getState().metricsBuckets.get(subscriptionId) ?? new Map();

export const getMetricsBucketsForCheck = (
  subscriptionId: string,
  provider: string,
  target: string,
  check: string,
) => {
  const key = `${provider}/${target}/${check}`;
  const subBuckets = useDataStore.getState().metricsBuckets.get(subscriptionId);
  return subBuckets?.get(key) ?? new Map();
};

export const getProviderEvents = (subscriptionId: string) =>
  useDataStore.getState().providerEvents.get(subscriptionId) ?? new Map();

export const getTargetEvents = (subscriptionId: string) =>
  useDataStore.getState().targetEvents.get(subscriptionId) ?? new Map();

export const getCheckEvents = (subscriptionId: string) =>
  useDataStore.getState().checkEvents.get(subscriptionId) ?? new Map();

export const getChannelBuckets = (subscriptionId: string) =>
  useDataStore.getState().channelBuckets.get(subscriptionId) ?? new Map();

export const getChannelEvents = (subscriptionId: string) =>
  useDataStore.getState().channelEvents.get(subscriptionId) ?? new Map();

export const getAgentBuckets = (subscriptionId: string) =>
  useDataStore.getState().agentBuckets.get(subscriptionId) ?? new Map();

export const getAgentEvents = (subscriptionId: string) =>
  useDataStore.getState().agentEvents.get(subscriptionId) ?? new Map();
