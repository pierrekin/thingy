import type { CheckConfig, Operator } from "./check.ts";
import type { Violation } from "../store/types.ts";

type EvaluationResult = {
  violations: Violation[];
};

/**
 * Evaluate a measurement against a resolved check config.
 * Returns any violations found.
 *
 * Note: This is point-in-time evaluation. The `over` field is handled
 * by the agent when aggregating samples before calling this.
 */
export function evaluate(
  measurement: Record<string, unknown>,
  config: CheckConfig,
  operators: readonly Operator[],
): EvaluationResult {
  const violations: Violation[] = [];

  for (const op of operators) {
    if (!(op in config)) continue;

    const threshold = config[op as keyof CheckConfig];
    if (threshold === undefined) continue;

    const violation = evaluateOperator(op, measurement, threshold);
    if (violation) {
      violations.push(violation);
    }
  }

  return { violations };
}

function evaluateOperator(
  op: Operator,
  measurement: Record<string, unknown>,
  threshold: unknown,
): Violation | null {
  // For now, assume the measurement has a single relevant field
  // In future, we might need to specify which field to compare
  const values = Object.entries(measurement);

  switch (op) {
    case "max": {
      for (const [field, actual] of values) {
        if (typeof actual === "number" && typeof threshold === "number") {
          if (actual > threshold) {
            return { rule: "max", threshold, actual };
          }
        }
      }
      return null;
    }

    case "min": {
      for (const [field, actual] of values) {
        if (typeof actual === "number" && typeof threshold === "number") {
          if (actual < threshold) {
            return { rule: "min", threshold, actual };
          }
        }
      }
      return null;
    }

    case "equals": {
      for (const [field, actual] of values) {
        if (actual !== threshold) {
          return { rule: "equals", threshold, actual };
        }
      }
      return null;
    }

    case "not": {
      for (const [field, actual] of values) {
        if (actual === threshold) {
          return { rule: "not", threshold, actual };
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Resolve a check config from target, provider, and default values.
 * Target config takes precedence over provider, which takes precedence over defaults.
 */
export function resolveCheckConfig<TConfig extends CheckConfig>(
  targetConfig: "__enabled__" | "__disabled__" | Partial<TConfig> | undefined,
  providerConfig: "__enabled__" | "__disabled__" | Partial<TConfig> | undefined,
  defaultConfig: TConfig,
  enabledByDefault: boolean = true,
): TConfig | false {
  // Target takes precedence
  const config = targetConfig !== undefined ? targetConfig : providerConfig;

  if (config === "__disabled__") return false;
  if (config === "__enabled__") return defaultConfig;
  if (config !== undefined) {
    // Merge with defaults - config overrides defaults
    return { ...defaultConfig, ...config };
  }

  // Neither specified - use default enabled state
  if (!enabledByDefault) return false;
  return defaultConfig;
}
