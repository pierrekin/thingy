import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors } from "mantle-framework";
import { validateAgentConfig } from "mantle-agent";
import { startHub, createChannelInstances, startChannelWorker, createSinkInstances, startSinkWorker, AgentConfigRegistry, type ResolvedAgentPayload } from "mantle-hub";
import { createSqliteStores } from "../store/sqlite.ts";
import { configArg, getHubConfig, getHubUrl } from "./shared.ts";

export const hub = defineCommand({
	meta: { name: "hub", description: "Run hub" },
	args: { config: configArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const hubConfig = getHubConfig(config);

		const allProviderConfigs = config.providers;
		const agentPayloads = new Map<string, ResolvedAgentPayload>();

		for (const [agentId, agentConfig] of Object.entries(config.agents)) {
			// Build a per-agent provider config containing only referenced providers
			const providerConfigs: Record<string, unknown> = {};
			for (const target of agentConfig.targets) {
				const name = target.provider;
				if (name in allProviderConfigs) {
					providerConfigs[name] = allProviderConfigs[name];
				}
			}

			// validateAgentConfig may mutate providerConfigs to add implicit {} entries
			validateAgentConfig(agentConfig, providerConfigs);

			agentPayloads.set(agentId, { agentConfig, providerConfigs });
		}

		const agentConfigRegistry = new AgentConfigRegistry(agentPayloads);

		const stores = createSqliteStores("mantle.db");
		await startHub(
			hubConfig,
			stores.outcomeStore, stores.eventStore, stores.bucketStore, stores.metricsStore,
			{ outcomeStore: stores.channelOutcomeStore, eventStore: stores.channelEventStore, bucketStore: stores.channelBucketStore },
			{ outcomeStore: stores.agentOutcomeStore, eventStore: stores.agentEventStore, bucketStore: stores.agentBucketStore },
			stores.channelOutboxStore,
			stores.sinkOutboxStore,
			agentConfigRegistry,
		);

		const hubUrl = getHubUrl(hubConfig);

		for (const ch of createChannelInstances(hubConfig.channels)) {
			void startChannelWorker(hubUrl, ch.name, ch.instance);
		}

		for (const s of createSinkInstances(hubConfig.sinks)) {
			void startSinkWorker(hubUrl, s.name, s.instance);
		}
	}),
});
