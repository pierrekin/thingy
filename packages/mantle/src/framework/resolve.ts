import { type CheckConfig, type Operator } from "./check.ts";
import type { ProviderDefinition } from "./provider.ts";
import type { AgentConfig } from "../config.ts";
import { parseInterval } from "../util/interval.ts";
import { resolveCheckConfig } from "./rules.ts";

export type ResolvedCheck = {
  name: string;
  config: CheckConfig;
  operators: readonly Operator[];
};

export type ResolvedTarget = {
  name: string;
  provider: string;
  type: string;
  interval: number;
  checks: ResolvedCheck[];
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

    const resolvedChecks: ResolvedCheck[] = [];

    for (const [checkName, binding] of Object.entries(targetTypeDef.checks)) {
      const targetCheckConfig = targetChecks?.[checkName];
      const providerCheckConfig = providerTypeChecks?.[checkName];
      const defaultConfig = binding.defaults ?? binding.check.defaults;
      const enabledByDefault = binding.enabled !== false;

      const config = resolveCheckConfig(
        targetCheckConfig as "__enabled__" | "__disabled__" | Partial<CheckConfig> | undefined,
        providerCheckConfig as "__enabled__" | "__disabled__" | Partial<CheckConfig> | undefined,
        defaultConfig,
        enabledByDefault,
      );

      if (config !== false) {
        resolvedChecks.push({
          name: checkName,
          config,
          operators: binding.check.operators,
        });
      }
    }

    resolved.push({
      name: target.name,
      provider: target.provider,
      type: targetType,
      interval: parseInterval(intervalStr),
      checks: resolvedChecks,
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
