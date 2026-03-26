import { DISABLED, ENABLED } from "./check.ts";

/**
 * Get the list of enabled check names for a target.
 */
export function resolveEnabledChecks(
  targetChecks: Record<string, unknown> | undefined,
  providerChecks: Record<string, unknown> | undefined,
  availableChecks: string[],
  defaultEnabled: Record<string, boolean> = {},
): string[] {
  const enabled: string[] = [];

  for (const checkName of availableChecks) {
    const targetValue = targetChecks?.[checkName];
    const providerValue = providerChecks?.[checkName];
    const value = targetValue !== undefined ? targetValue : providerValue;

    if (value === DISABLED) {
      continue;
    }

    if (value === ENABLED || value !== undefined) {
      enabled.push(checkName);
      continue;
    }

    // Neither specified - use default
    if (defaultEnabled[checkName] !== false) {
      enabled.push(checkName);
    }
  }

  return enabled;
}
