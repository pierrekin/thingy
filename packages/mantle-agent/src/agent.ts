import type { AgentConfig, ProviderInstance } from "mantle-framework";
import {
	resolveAgentConfig,
	isCheckError,
	evaluate,
	type ResolvedCheck,
} from "mantle-framework";
import { getProvider, getProviderDefinition, getProviderType } from "mantle-providers";
import { IntervalScheduler } from "./scheduler/index.ts";
import type { CheckReporter } from "./hub-client.ts";

type ProviderConfigs = Record<string, unknown>;

export function startTargets(
	agentId: string,
	agentConfig: AgentConfig,
	providerConfigs: ProviderConfigs,
	checkReporter: CheckReporter,
) {
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
							? evaluate(result.check, result.value, checkConfig.config, checkConfig.operators, checkConfig.enumValues)
							: { violations: [] };

						const violation = violations[0];

						if (violation) {
							console.log(`[${resolved.name}] ${result.check}: VIOLATION ${violation.code} (${violation.actual} ${violation.rule} ${violation.threshold})`);
						} else {
							console.log(`[${resolved.name}] ${result.check}: ${JSON.stringify(result.value)}`);
						}

						checkReporter.sendCheckResult(
							resolved.provider,
							resolved.name,
							result.check,
							time,
							{ ok: true, measurement: result.value, violation },
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
