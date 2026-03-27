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
  | { success: true; value: Record<string, unknown>; violation?: Violation }
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
};

export type OpenTargetEvent = {
  id: number;
  provider: string;
  target: string;
  code: string;
};

export type OpenCheckEvent = {
  id: number;
  provider: string;
  target: string;
  check: string;
  code: string;
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

  close(): Promise<void>;
}
