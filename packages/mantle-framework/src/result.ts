import type { OutcomeError } from "./types.ts";

export type CheckResult =
  | {
      check: string;
      value: number;
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

export function isCheckSuccess(
  result: CheckResult
): result is { check: string; value: number } {
  return "value" in result;
}
