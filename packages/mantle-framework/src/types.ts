// Domain types: the shared vocabulary of the mantle project.

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

export type ChannelOutcome =
  | { success: true }
  | { success: false; error: string };

export type AgentOutcome =
  | { success: true }
  | { success: false; error: string };

export type BucketStatus = "green" | "red" | "grey" | null;
