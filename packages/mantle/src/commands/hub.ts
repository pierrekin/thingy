import { defineCommand } from "citty";
import { loadConfig } from "../config.ts";
import { handleOperationalErrors } from "../errors.ts";
import { startHub } from "../hub/index.ts";
import { createSqliteStores } from "../store/index.ts";
import { createChannelInstances } from "../create-channels.ts";
import { configArg, getHubConfig } from "./shared.ts";

export const hub = defineCommand({
	meta: { name: "hub", description: "Run hub" },
	args: { config: configArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const hubConfig = getHubConfig(config);
		const stores = createSqliteStores("mantle.db");
		const channels = createChannelInstances(config.channels ?? {});
		await startHub(hubConfig, stores.outcomeStore, stores.eventStore, stores.bucketStore, stores.metricsStore, channels, {
			outcomeStore: stores.channelOutcomeStore,
			eventStore: stores.channelEventStore,
			bucketStore: stores.channelBucketStore,
		}, {
			outcomeStore: stores.agentOutcomeStore,
			eventStore: stores.agentEventStore,
			bucketStore: stores.agentBucketStore,
		});
	}),
});
