import type { OutcomeError } from "../store/types.ts";

export type CheckResult =
  | {
      check: string;
      measurement: Record<string, unknown>;
    }
  | {
      check: string;
      error: OutcomeError;
    };

export function isCheckError(
  result: CheckResult
): result is { check: string; error: OutcomeError } {
  return "error" in result;
}

export function isCheckMeasurement(
  result: CheckResult
): result is { check: string; measurement: Record<string, unknown> } {
  return "measurement" in result;
}
