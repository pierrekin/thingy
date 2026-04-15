import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors } from "mantle-framework";
import { startHub } from "mantle-hub";
import { startAgent } from "mantle-agent";
import { createSqliteStores } from "../store/sqlite.ts";
import { createHubReporters } from "mantle-agent";
import { createChannelInstances, startChannelWorker, createSinkInstances, startSinkWorker } from "mantle-hub";
import { configArg, agentArg, getHubConfig, getHubUrl, getAgentConfig } from "./shared.ts";

export const standalone = defineCommand({
	meta: { name: "standalone", description: "Run standalone" },
	args: { config: configArg, agent: agentArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const hubConfig = getHubConfig(config);
		const { id, config: agentConfig } = getAgentConfig(config, args.agent);

		const stores = createSqliteStores("mantle.db");
		await startHub(
			hubConfig,
			stores.outcomeStore, stores.eventStore, stores.bucketStore, stores.metricsStore,
			{ outcomeStore: stores.channelOutcomeStore, eventStore: stores.channelEventStore, bucketStore: stores.channelBucketStore },
			{ outcomeStore: stores.agentOutcomeStore, eventStore: stores.agentEventStore, bucketStore: stores.agentBucketStore },
			stores.channelOutboxStore,
			stores.sinkOutboxStore,
		);

		const hubUrl = getHubUrl(hubConfig);
		const channels = createChannelInstances(config.channels ?? {});
		const sinks = createSinkInstances(config.sinks ?? {});

		for (const channel of channels) {
			void startChannelWorker(hubUrl, channel.name, channel.instance);
		}

		for (const sink of sinks) {
			void startSinkWorker(hubUrl, sink.name, sink.instance);
		}

		const { checkReporter } = await createHubReporters(id, hubUrl);
		startAgent(id, agentConfig, config.providers ?? {}, checkReporter);
	}),
});
