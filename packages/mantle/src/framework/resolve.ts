import { DISABLED, ENABLED } from "./check.ts";
import type { ProviderDefinition } from "./provider.ts";
import type { AgentConfig } from "../config.ts";
import { parseInterval } from "../util/interval.ts";

export type ResolvedTarget = {
  name: string;
  provider: string;
  type: string;
  interval: number;
  checks: string[];
  target: unknown;
};

/**
 * Resolve agent config using provider definitions.
 * Produces fully-resolved targets ready for scheduling.
 */
export function resolveAgentConfig(
  agentConfig: AgentConfig,
  providerConfigs: Record<string, unknown>,
  getProviderDefinition: (providerType: string) => ProviderDefinition | undefined,
): ResolvedTarget[] {
  const resolved: ResolvedTarget[] = [];

  for (const target of agentConfig.targets) {
    const providerConfig = providerConfigs[target.provider] as Record<string, unknown> | undefined;
    const providerType = getProviderType(target.provider, providerConfig);
    const providerDef = getProviderDefinition(providerType);

    if (!providerDef) {
      continue; // validation should catch this earlier
    }

    const targetType = (target as { type?: string }).type;
    if (!targetType) {
      continue;
    }

    const targetTypeDef = providerDef.targetTypes[targetType];
    if (!targetTypeDef) {
      continue;
    }

    // Resolve interval
    const targetInterval = (target as { interval?: string }).interval;
    const providerIntervals = providerConfig?.intervals as Record<string, string> | undefined;
    const providerInterval = providerConfig?.interval as string | undefined;

    const intervalStr =
      targetInterval ??
      providerIntervals?.[targetType] ??
      providerInterval ??
      agentConfig.interval ??
      targetTypeDef.defaultInterval ??
      providerDef.defaultInterval ??
      "30s";

    // Resolve checks
    const targetChecks = (target as { checks?: Record<string, unknown> }).checks;
    const providerChecks = providerConfig?.checks as Record<string, Record<string, unknown>> | undefined;
    const providerTypeChecks = providerChecks?.[targetType];

    const availableChecks = Object.keys(targetTypeDef.checks);
    const defaultEnabled: Record<string, boolean> = {};
    for (const [name, binding] of Object.entries(targetTypeDef.checks)) {
      defaultEnabled[name] = binding.enabled !== false;
    }

    const enabledChecks = resolveEnabledChecks(
      targetChecks,
      providerTypeChecks,
      availableChecks,
      defaultEnabled,
    );

    resolved.push({
      name: target.name,
      provider: target.provider,
      type: targetType,
      interval: parseInterval(intervalStr),
      checks: enabledChecks,
      target,
    });
  }

  return resolved;
}

function getProviderType(instanceName: string, instanceConfig: unknown): string {
  if (
    instanceConfig &&
    typeof instanceConfig === "object" &&
    "type" in instanceConfig &&
    typeof instanceConfig.type === "string"
  ) {
    return instanceConfig.type;
  }
  return instanceName;
}

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
