import type { CheckConfig, EnumValues, Operator } from "./check.ts";
import type { Violation } from "./types.ts";

type EvaluationResult = {
  violations: Violation[];
};

/**
 * Evaluate a value against a resolved check config.
 * Returns any violations found.
 *
 * Note: This is point-in-time evaluation. The `over` field is handled
 * by the agent when aggregating samples before calling this.
 */
export function evaluate(
  checkName: string,
  value: number,
  config: CheckConfig,
  operators: readonly Operator[],
  enumValues?: EnumValues,
): EvaluationResult {
  const violations: Violation[] = [];

  for (const op of operators) {
    if (!(op in config)) continue;

    const threshold = config[op as keyof CheckConfig];
    if (threshold === undefined) continue;

    // Warn and skip ordinal operators on enum checks
    if (enumValues && (op === "max" || op === "min")) {
      console.warn(
        `[${checkName}] Ignoring '${op}' operator on enum check — enum values are not orderable. Use 'equals' or 'not' instead.`,
      );
      continue;
    }

    const resolved = enumValues ? resolveEnumThreshold(threshold, enumValues) : threshold;

    const violation = evaluateOperator(checkName, op, value, resolved);
    if (violation) {
      // Display the original threshold (tag name) in violation output, not the resolved index
      if (enumValues && resolved !== threshold) {
        violation.threshold = threshold;
      }
      violations.push(violation);
    }
  }

  return { violations };
}

/**
 * If the threshold is a string enum tag, resolve it to its numeric index.
 */
function resolveEnumThreshold(threshold: unknown, enumValues: EnumValues): unknown {
  if (typeof threshold === "string" && threshold in enumValues) {
    return enumValues[threshold];
  }
  return threshold;
}

function evaluateOperator(
  checkName: string,
  op: Operator,
  actual: number,
  threshold: unknown,
): Violation | null {
  switch (op) {
    case "max": {
      if (typeof threshold === "number" && actual > threshold) {
        return { code: `${checkName}:max`, rule: "max", threshold, actual };
      }
      return null;
    }

    case "min": {
      if (typeof threshold === "number" && actual < threshold) {
        return { code: `${checkName}:min`, rule: "min", threshold, actual };
      }
      return null;
    }

    case "equals": {
      if (actual !== threshold) {
        return { code: `${checkName}:equals`, rule: "equals", threshold, actual };
      }
      return null;
    }

    case "not": {
      if (actual === threshold) {
        return { code: `${checkName}:not`, rule: "not", threshold, actual };
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
