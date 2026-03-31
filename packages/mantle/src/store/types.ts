export type OutcomeError = {
  level: "provider" | "target" | "check";
  code: string;
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

export interface OutcomeStore {
  recordProviderOutcome(
    provider: string,
    time: Date,
    outcome: ProviderOutcome
  ): Promise<void>;

  recordTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    outcome: TargetOutcome
  ): Promise<void>;

  recordCheckOutcome(
    provider: string,
    target: string,
    check: string,
    time: Date,
    outcome: CheckOutcome
  ): Promise<void>;

  close(): Promise<void>;
}

export type OpenProviderEvent = {
  id: number;
  provider: string;
  code: string;
  startTime: number;
  message: string;
};

export type OpenTargetEvent = {
  id: number;
  provider: string;
  target: string;
  code: string;
  startTime: number;
  message: string;
};

export type OpenCheckEvent = {
  id: number;
  provider: string;
  target: string;
  check: string;
  code: string;
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
    time: Date,
    message: string
  ): Promise<number>;

  closeProviderEvent(id: number, time: Date): Promise<void>;

  openTargetEvent(
    provider: string,
    target: string,
    code: string,
    time: Date,
    message: string
  ): Promise<number>;

  closeTargetEvent(id: number, time: Date): Promise<void>;

  openCheckEvent(
    provider: string,
    target: string,
    check: string,
    code: string,
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
  startTime: number;
  endTime: number | null;
  message: string;
};

export type TargetEventRecord = {
  id: number;
  provider: string;
  target: string;
  code: string;
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
