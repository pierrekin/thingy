export type OutcomeError = {
  level: "provider" | "target" | "check";
  message: string;
};

export type Violation = {
  rule: string;
  threshold: unknown;
  actual: unknown;
};

export interface OutcomeStore {
  recordProviderOutcome(
    provider: string,
    time: Date,
    result: { value?: Record<string, unknown>; error?: OutcomeError }
  ): Promise<void>;

  recordTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    result: { value?: Record<string, unknown>; error?: OutcomeError }
  ): Promise<void>;

  recordCheckOutcome(
    provider: string,
    target: string,
    check: string,
    time: Date,
    result: {
      value?: Record<string, unknown>;
      violation?: Violation;
      error?: OutcomeError;
    }
  ): Promise<void>;

  close(): Promise<void>;
}
