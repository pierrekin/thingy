export type OutcomeError = {
  level: "provider" | "target" | "check";
  code: string;
  title: string;
  message: string;
};

export type Violation = {
  code: string;
  rule: string;
  threshold: unknown;
  actual: unknown;
};

export type ProviderOutcome =
  | { success: true }
  | { success: false; error: OutcomeError };

export type TargetOutcome =
  | { success: true }
  | { success: false; error: OutcomeError };

export type CheckOutcome =
  | { success: true; value: number; violation?: Violation }
  | { success: false; error: OutcomeError };

export type StoredOutcome = {
  id: number;
  time: number;
  success: boolean;
  error: string | null;
  value: number | null;
  violation: string | null;
};

export interface OutcomeStore {
  recordProviderOutcome(
    provider: string,
    time: Date,
    outcome: ProviderOutcome,
    eventId?: number,
  ): Promise<void>;

  recordTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    outcome: TargetOutcome,
    eventId?: number,
  ): Promise<void>;

  recordCheckOutcome(
    provider: string,
    target: string,
    check: string,
    time: Date,
    outcome: CheckOutcome,
    eventId?: number,
  ): Promise<void>;

  getOutcomesForEvent(
    eventId: number,
    level: "provider" | "target" | "check",
    limit?: number,
    offset?: number,
  ): Promise<StoredOutcome[]>;

  getLatestTargetOutcomes(): Promise<Array<{
    provider: string;
    target: string;
    success: boolean;
  }>>;

  close(): Promise<void>;
}

export type OpenProviderEvent = {
  id: number;
  provider: string;
  code: string;
  title: string;
  startTime: number;
  message: string;
};

export type OpenTargetEvent = {
  id: number;
  provider: string;
  target: string;
  code: string;
  title: string;
  startTime: number;
  message: string;
};

export type OpenCheckEvent = {
  id: number;
  provider: string;
  target: string;
  check: string;
  code: string;
  title: string;
  startTime: number;
  message: string;
};

export interface EventStore {
  getOpenProviderEvents(): Promise<OpenProviderEvent[]>;
  getOpenTargetEvents(): Promise<OpenTargetEvent[]>;
  getOpenCheckEvents(): Promise<OpenCheckEvent[]>;

  openProviderEvent(
    provider: string,
    code: string,
    title: string,
    time: Date,
    message: string
  ): Promise<number>;

  closeProviderEvent(id: number, time: Date): Promise<void>;

  openTargetEvent(
    provider: string,
    target: string,
    code: string,
    title: string,
    time: Date,
    message: string
  ): Promise<number>;

  closeTargetEvent(id: number, time: Date): Promise<void>;

  openCheckEvent(
    provider: string,
    target: string,
    check: string,
    code: string,
    title: string,
    kind: "error" | "violation",
    time: Date,
    message: string
  ): Promise<number>;

  closeCheckEvent(id: number, time: Date): Promise<void>;

  getEventsInRange(startTime: number, endTime: number): Promise<StoredEvents>;

  close(): Promise<void>;
}

export type ProviderEventRecord = {
  id: number;
  provider: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

export type TargetEventRecord = {
  id: number;
  provider: string;
  target: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

export type CheckEventRecord = {
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

export type BucketStatus = "green" | "red" | "grey" | null;

export type ProviderBucket = {
  provider: string;
  bucketStart: number;
  bucketEnd: number;
  status: BucketStatus;
};

export type TargetBucket = {
  provider: string;
  target: string;
  bucketStart: number;
  bucketEnd: number;
  status: BucketStatus;
};

export type CheckBucket = {
  provider: string;
  target: string;
  check: string;
  bucketStart: number;
  bucketEnd: number;
  status: BucketStatus;
};

export type StoredBuckets = {
  providers: ProviderBucket[];
  targets: TargetBucket[];
  checks: CheckBucket[];
};

export type StoredEvents = {
  providers: ProviderEventRecord[];
  targets: TargetEventRecord[];
  checks: CheckEventRecord[];
};

export interface BucketStore {
  getProviderBucketStatus(
    provider: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined>;

  getTargetBucketStatus(
    provider: string,
    target: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined>;

  getCheckBucketStatus(
    provider: string,
    target: string,
    check: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined>;

  setProviderBucket(
    provider: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<void>;

  setTargetBucket(
    provider: string,
    target: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<void>;

  setCheckBucket(
    provider: string,
    target: string,
    check: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<void>;

  getBuckets(startTime: number, endTime: number): Promise<StoredBuckets>;

  close(): Promise<void>;
}

export type MetricBucket = {
  bucketStart: number;
  bucketEnd: number;
  mean: number | null;
};

// --- Channel types ---

export type ChannelOutcome =
  | { success: true }
  | { success: false; error: string };

export type ChannelEventRecord = {
  id: number;
  channel: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

export type OpenChannelEvent = {
  id: number;
  channel: string;
  code: string;
  title: string;
  startTime: number;
  message: string;
};

export type ChannelBucket = {
  channel: string;
  bucketStart: number;
  bucketEnd: number;
  status: BucketStatus;
};

export type StoredChannelOutcome = {
  id: number;
  time: number;
  success: boolean;
  error: string | null;
};

export interface ChannelOutcomeStore {
  recordChannelOutcome(
    channel: string,
    time: Date,
    outcome: ChannelOutcome,
    eventId?: number,
  ): Promise<void>;

  close(): Promise<void>;
}

export interface ChannelEventStore {
  getOpenChannelEvents(): Promise<OpenChannelEvent[]>;

  openChannelEvent(
    channel: string,
    code: string,
    title: string,
    time: Date,
    message: string,
  ): Promise<number>;

  closeChannelEvent(id: number, time: Date): Promise<void>;

  getChannelEventsInRange(startTime: number, endTime: number): Promise<ChannelEventRecord[]>;

  close(): Promise<void>;
}

export interface ChannelBucketStore {
  getChannelBucketStatus(
    channel: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined>;

  setChannelBucket(
    channel: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus,
  ): Promise<void>;

  getChannelBuckets(startTime: number, endTime: number): Promise<ChannelBucket[]>;

  close(): Promise<void>;
}

// --- Agent types ---

export type AgentOutcome =
  | { success: true }
  | { success: false; error: string };

export type AgentEventRecord = {
  id: number;
  agent: string;
  code: string;
  title: string;
  startTime: number;
  endTime: number | null;
  message: string;
};

export type OpenAgentEvent = {
  id: number;
  agent: string;
  code: string;
  title: string;
  startTime: number;
  message: string;
};

export type AgentBucket = {
  agent: string;
  bucketStart: number;
  bucketEnd: number;
  status: BucketStatus;
};

export interface AgentOutcomeStore {
  recordAgentOutcome(
    agent: string,
    time: Date,
    outcome: AgentOutcome,
    eventId?: number,
  ): Promise<void>;

  close(): Promise<void>;
}

export interface AgentEventStore {
  getOpenAgentEvents(): Promise<OpenAgentEvent[]>;

  openAgentEvent(
    agent: string,
    code: string,
    title: string,
    time: Date,
    message: string,
  ): Promise<number>;

  closeAgentEvent(id: number, time: Date): Promise<void>;

  getAgentEventsInRange(startTime: number, endTime: number): Promise<AgentEventRecord[]>;

  close(): Promise<void>;
}

export interface AgentBucketStore {
  getAgentBucketStatus(
    agent: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined>;

  setAgentBucket(
    agent: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus,
  ): Promise<void>;

  getAgentBuckets(startTime: number, endTime: number): Promise<AgentBucket[]>;

  close(): Promise<void>;
}

export interface MetricsStore {
  /**
   * Get aggregated metrics for a specific check in a time range.
   * Groups raw values into buckets and computes mean per bucket.
   */
  getAggregatedMetrics(
    provider: string,
    target: string,
    check: string,
    startTime: number,
    endTime: number,
    bucketDurationMs: number
  ): Promise<MetricBucket[]>;

  close(): Promise<void>;
}
