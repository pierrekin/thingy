import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors, resolvePlacements } from "mantle-framework";
import { startHub, createChannelInstances, startChannelWorker, createSinkInstances, startSinkWorker } from "mantle-hub";
import { createSqliteStores } from "../store/sqlite.ts";
import { configArg, getHubConfig, getHubUrl } from "./shared.ts";

export const hub = defineCommand({
	meta: { name: "hub", description: "Run hub" },
	args: { config: configArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const hubConfig = getHubConfig(config);
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
		const channelConfigs = resolvePlacements(hubConfig.channels, config.channels);
		const sinkConfigs = resolvePlacements(hubConfig.sinks, config.sinks);

		for (const ch of createChannelInstances(channelConfigs)) {
			void startChannelWorker(hubUrl, ch.name, ch.instance);
		}

		for (const s of createSinkInstances(sinkConfigs)) {
			void startSinkWorker(hubUrl, s.name, s.instance);
		}
	}),
});
