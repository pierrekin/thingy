import type { AgentConfig } from "../config.ts";
import { OperationalError } from "../errors.ts";
import { getProvider } from "../providers.ts";
import {
	printResolvedConfig,
	type TargetConfig,
	type ProviderConfig,
} from "provider-proxmox";

type ProviderConfigs = Record<string, unknown>;

function getProviderType(
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

function formatProviderName(instanceName: string, providerType: string): string {
	if (instanceName === providerType) {
		return instanceName;
	}
	return `${instanceName} (${providerType})`;
}

function validateProviderConfig(
	instanceName: string,
	instanceConfig: unknown,
) {
	const providerType = getProviderType(instanceName, instanceConfig);
	const displayName = formatProviderName(instanceName, providerType);
	const provider = getProvider(providerType);
	if (!provider) {
		throw new OperationalError(`Unknown provider type '${providerType}' for '${instanceName}'`);
	}

	if (provider.providerConfigSchema === null) {
		if (instanceConfig !== undefined) {
			throw new OperationalError(
				`Provider '${displayName}' does not accept configuration`,
			);
		}
		return;
	}

	if (instanceConfig === undefined) {
		throw new OperationalError(
			`Provider '${displayName}' requires configuration in 'providers.${instanceName}'`,
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

function validateAgentConfig(
	agentConfig: AgentConfig,
	providerConfigs: ProviderConfigs,
) {
	// Track which provider instances are used by targets
	const usedProviderInstances = new Set<string>();

	// Validate target configs and collect used providers
	for (const target of agentConfig.targets) {
		const instanceName = target.provider;
		const instanceConfig = providerConfigs[instanceName];

		if (instanceConfig === undefined) {
			throw new OperationalError(
				`Provider '${instanceName}' not found for target '${target.name}'`,
			);
		}

		const providerType = getProviderType(instanceName, instanceConfig);
		const provider = getProvider(providerType);
		if (!provider) {
			throw new OperationalError(
				`Unknown provider type '${providerType}' for target '${target.name}'`,
			);
		}

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

	// Validate provider configs for all used providers
	for (const instanceName of usedProviderInstances) {
		const instanceConfig = providerConfigs[instanceName];
		validateProviderConfig(instanceName, instanceConfig);
	}

	// Validate any explicitly configured providers not used by targets
	for (const [name, instanceConfig] of Object.entries(providerConfigs)) {
		if (!usedProviderInstances.has(name)) {
			validateProviderConfig(name, instanceConfig);
		}
	}
}

export function startAgent(
	agentId: string,
	agentConfig: AgentConfig,
	providerConfigs: ProviderConfigs = {},
) {
	validateAgentConfig(agentConfig, providerConfigs);

	console.log(`Starting agent '${agentId}': ${agentConfig.name}`);
	console.log(`Targets: ${agentConfig.targets.length}`);
	console.log("");

	// Group targets by provider instance
	const targetsByInstance = new Map<string, typeof agentConfig.targets>();
	for (const target of agentConfig.targets) {
		const existing = targetsByInstance.get(target.provider) ?? [];
		existing.push(target);
		targetsByInstance.set(target.provider, existing);
	}

	// Print resolved config for each proxmox instance
	for (const [instanceName, targets] of targetsByInstance) {
		const instanceConfig = providerConfigs[instanceName];
		const providerType = getProviderType(instanceName, instanceConfig);

		if (providerType === "proxmox" && instanceConfig) {
			console.log(`Provider instance: ${instanceName}`);
			printResolvedConfig(
				targets as TargetConfig[],
				instanceConfig as ProviderConfig,
				agentConfig.interval,
			);
			console.log("");
		}
	}
}
