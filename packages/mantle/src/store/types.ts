export type OutcomeError = {
  level: "provider" | "target" | "check";
  message: string;
};

export type Violation = {
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
