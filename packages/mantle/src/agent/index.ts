import type { AgentConfig } from "../config.ts";
import { OperationalError } from "../errors.ts";
import { getProvider } from "../providers.ts";
import type { ProviderInstance } from "../provider.ts";
import { IntervalScheduler } from "../scheduler/index.ts";
import {
  resolveAgentConfig,
  isCheckError,
  evaluate,
  type ResolvedCheck,
} from "../framework/index.ts";
import type { CheckReporter } from "./hub-client.ts";

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

function getProviderDefinition(providerType: string) {
	const provider = getProvider(providerType);
	return provider?.definition;
}

export function startAgent(
	agentId: string,
	agentConfig: AgentConfig,
	providerConfigs: ProviderConfigs,
	checkReporter: CheckReporter,
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

	// Resolve targets using framework
	const resolvedTargets = resolveAgentConfig(agentConfig, providerConfigs, getProviderDefinition);

	// Set up scheduler
	const scheduler = new IntervalScheduler();

	for (const resolved of resolvedTargets) {
		const instance = providerInstances.get(resolved.provider);
		if (!instance) {
			console.warn(`No provider instance for target '${resolved.name}'`);
			continue;
		}

		// Build a map for quick lookup of check configs
		const checkConfigMap = new Map<string, ResolvedCheck>();
		for (const check of resolved.checks) {
			checkConfigMap.set(check.name, check);
		}
		const checkNames = resolved.checks.map((c) => c.name);

		scheduler.add({
			id: `${resolved.provider}:${resolved.name}`,
			interval: resolved.interval,
			run: async () => {
				const time = new Date();
				const results = await instance.check(resolved.target, checkNames);

				for (const result of results) {
					if (isCheckError(result)) {
						const { level, message } = result.error;
						console.log(`[${resolved.name}] ${result.check}: ${level.toUpperCase()} ERROR - ${message}`);

						checkReporter.sendCheckResult(
							resolved.provider,
							resolved.name,
							result.check,
							time,
							{ ok: false, error: result.error },
						);
					} else {
						// Evaluate measurement against rules
						const checkConfig = checkConfigMap.get(result.check);
						const { violations } = checkConfig
							? evaluate(result.check, result.measurement, checkConfig.config, checkConfig.operators)
							: { violations: [] };

						const violation = violations[0];

						if (violation) {
							console.log(`[${resolved.name}] ${result.check}: VIOLATION ${violation.code} (${violation.actual} ${violation.rule} ${violation.threshold})`);
						} else {
							console.log(`[${resolved.name}] ${result.check}: ${JSON.stringify(result.measurement)}`);
						}

						checkReporter.sendCheckResult(
							resolved.provider,
							resolved.name,
							result.check,
							time,
							{ ok: true, measurement: result.measurement, violation },
						);
					}
				}
			},
		});

		const intervalStr = `${resolved.interval}ms`;
		console.log(`Scheduled: ${resolved.name} (every ${intervalStr}) - checks: [${checkNames.join(", ")}]`);
	}

	console.log("");
	console.log("Starting scheduler...");
	scheduler.start();

	return scheduler;
}
