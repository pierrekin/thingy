import type { AgentConfig } from "../config.ts";
import { OperationalError } from "../errors.ts";
import { getProvider } from "../providers.ts";
import type { ProviderInstance } from "../provider.ts";
import { IntervalScheduler } from "../scheduler/index.ts";
import { parseInterval } from "../util/index.ts";
import {
  resolveEnabledChecks,
  isCheckError,
} from "../framework/index.ts";
import type { OutcomeStore } from "../store/types.ts";

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

// Get available checks for a target type from provider definition
function getAvailableChecks(targetType: string): string[] {
	// TODO: This should come from the provider definition
	// For now, hardcode based on proxmox
	switch (targetType) {
		case "vm":
		case "lxc":
			return ["state"];
		case "node":
			return ["online"];
		default:
			return [];
	}
}

export function startAgent(
	agentId: string,
	agentConfig: AgentConfig,
	providerConfigs: ProviderConfigs = {},
	store?: OutcomeStore,
) {
	validateAgentConfig(agentConfig, providerConfigs);

	console.log(`Starting agent '${agentId}': ${agentConfig.name}`);
	console.log(`Targets: ${agentConfig.targets.length}`);
	console.log("");

	// Instantiate providers
	const providerInstances = new Map<string, ProviderInstance>();
	for (const [instanceName, instanceConfig] of Object.entries(providerConfigs)) {
		const providerType = getProviderType(instanceName, instanceConfig);
		const provider = getProvider(providerType);
		if (provider?.createInstance) {
			providerInstances.set(instanceName, provider.createInstance(instanceConfig));
		}
	}

	// Set up scheduler
	const scheduler = new IntervalScheduler();

	for (const target of agentConfig.targets) {
		const instance = providerInstances.get(target.provider);
		if (!instance) {
			console.warn(`No provider instance for target '${target.name}'`);
			continue;
		}

		const targetInterval = "interval" in target ? (target.interval as string) : undefined;
		const interval = targetInterval ?? agentConfig.interval ?? "30s";

		// Resolve which checks to run
		const targetChecks = "checks" in target ? (target.checks as Record<string, unknown>) : undefined;
		const providerConfig = providerConfigs[target.provider] as Record<string, unknown> | undefined;
		const providerChecks = providerConfig?.checks as Record<string, Record<string, unknown>> | undefined;
		const targetTypeChecks = providerChecks?.[target.type as string];
		const availableChecks = getAvailableChecks(target.type as string);
		const enabledChecks = resolveEnabledChecks(targetChecks, targetTypeChecks, availableChecks);

		scheduler.add({
			id: `${target.provider}:${target.name}`,
			interval: parseInterval(interval),
			run: async () => {
				const time = new Date();
				const results = await instance.check(target, enabledChecks);

				for (const result of results) {
					if (isCheckError(result)) {
						console.log(`[${target.name}] ${result.check}: ERROR - ${result.error.message}`);
						if (store) {
							await store.recordCheckOutcome(
								target.provider,
								target.name,
								result.check,
								time,
								{ error: result.error }
							);
						}
					} else {
						console.log(`[${target.name}] ${result.check}: ${JSON.stringify(result.measurement)}`);
						if (store) {
							await store.recordCheckOutcome(
								target.provider,
								target.name,
								result.check,
								time,
								{ value: result.measurement }
							);
						}
					}
				}
			},
		});

		console.log(`Scheduled: ${target.name} (every ${interval}) - checks: [${enabledChecks.join(", ")}]`);
	}

	console.log("");
	console.log("Starting scheduler...");
	scheduler.start();

	return scheduler;
}
