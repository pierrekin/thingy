import type {
  AgentConfig,
  Provider,
  ProviderDefinition,
} from "mantle-framework";
import { InvariantError, OperationalError } from "mantle-framework";
import { providers as bazarrProviders } from "provider-bazarr";
import { providers as caddyProviders } from "provider-caddy";
import { providers as jellyfinProviders } from "provider-jellyfin";
import { providers as mylarrProviders } from "provider-mylarr";
import { providers as nzbhydra2Providers } from "provider-nzbhydra2";
import { providers as proxmoxProviders } from "provider-proxmox";
import { providers as resticProviders } from "provider-restic";
import { providers as servarrProviders } from "provider-servarr";
import { providers as shellProviders } from "provider-shell";
import { providers as tautulliProviders } from "provider-tautulli";

const allProviders = [
  ...proxmoxProviders,
  ...resticProviders,
  ...shellProviders,
  ...servarrProviders,
  ...mylarrProviders,
  ...bazarrProviders,
  ...jellyfinProviders,
  ...tautulliProviders,
  ...nzbhydra2Providers,
  ...caddyProviders,
];

const registry: Record<string, Provider> = Object.fromEntries(
  allProviders.map((p) => [p.name, p]),
);

export function hasProvider(name: string): boolean {
  return name in registry;
}

export function getProvider(name: string): Provider {
  const provider = registry[name];
  if (!provider) {
    throw new InvariantError(
      `getProvider called for '${name}' but it is not registered — call hasProvider first or validate the config before lookup`,
    );
  }
  return provider;
}

export function getAllProviders(): Provider[] {
  return allProviders;
}

export function getProviderDefinition(
  providerType: string,
): ProviderDefinition | undefined {
  return registry[providerType]?.definition;
}

export function getProviderType(
  instanceName: string,
  instanceConfig: unknown,
): string {
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

function formatProviderName(
  instanceName: string,
  providerType: string,
): string {
  if (instanceName === providerType) {
    return instanceName;
  }
  return `${instanceName} (${providerType})`;
}

function validateProviderConfig(instanceName: string, instanceConfig: unknown) {
  const providerType = getProviderType(instanceName, instanceConfig);
  const displayName = formatProviderName(instanceName, providerType);
  if (!hasProvider(providerType)) {
    throw new OperationalError(
      `Unknown provider type '${providerType}' for '${instanceName}'`,
    );
  }
  const provider = getProvider(providerType);

  if (provider.providerConfigSchema === null) {
    if (instanceConfig !== undefined) {
      throw new OperationalError(
        `Provider '${displayName}' does not accept configuration`,
      );
    }
    return;
  }

  if (instanceConfig === null || instanceConfig === undefined) {
    throw new OperationalError(
      `Provider '${displayName}' has an empty configuration — either provide values or remove it`,
    );
  }

  const result = provider.providerConfigSchema.safeParse(instanceConfig);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new OperationalError(
      `Invalid config for provider '${displayName}':\n${issues}`,
    );
  }
}

export function validateAgentConfig(
  agentConfig: AgentConfig,
  providerConfigs: Record<string, unknown>,
) {
  const usedProviderInstances = new Set<string>();

  for (const target of agentConfig.targets) {
    const instanceName = target.provider;
    let instanceConfig = providerConfigs[instanceName];

    // Provider not declared — try to use it implicitly with empty config
    if (instanceConfig === undefined) {
      if (!hasProvider(instanceName)) {
        throw new OperationalError(
          `Unknown provider '${instanceName}' for target '${target.name}'`,
        );
      }
      const provider = getProvider(instanceName);

      if (provider.providerConfigSchema !== null) {
        const result = provider.providerConfigSchema.safeParse({});
        if (!result.success) {
          throw new OperationalError(
            `Provider '${instanceName}' requires configuration`,
          );
        }
      }

      // Register the implicit provider so it gets instantiated later
      providerConfigs[instanceName] = {};
      instanceConfig = {};
    }

    const providerType = getProviderType(instanceName, instanceConfig);
    if (!hasProvider(providerType)) {
      throw new OperationalError(
        `Unknown provider type '${providerType}' for target '${target.name}'`,
      );
    }
    const provider = getProvider(providerType);

    usedProviderInstances.add(instanceName);

    const result = provider.targetConfigSchema.safeParse(target);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new OperationalError(
        `Invalid config for target '${target.name}':\n${issues}`,
      );
    }
  }

  for (const instanceName of usedProviderInstances) {
    const instanceConfig = providerConfigs[instanceName];
    validateProviderConfig(instanceName, instanceConfig);
  }

  for (const [name, instanceConfig] of Object.entries(providerConfigs)) {
    if (!usedProviderInstances.has(name)) {
      validateProviderConfig(name, instanceConfig);
    }
  }
}
