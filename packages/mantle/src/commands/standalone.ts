import { defineCommand } from "citty";
import { loadConfig } from "../config.ts";
import { handleOperationalErrors } from "../errors.ts";
import { startHub } from "../hub/index.ts";
import { startAgent } from "../agent/index.ts";
import { createSqliteStores } from "../store/index.ts";
import { createHubReporters } from "../agent/hub-client.ts";
import { createChannelInstances } from "../create-channels.ts";
import { configArg, agentArg, getHubConfig, getHubUrl, getAgentConfig } from "./shared.ts";

export const standalone = defineCommand({
	meta: { name: "standalone", description: "Run standalone" },
	args: { config: configArg, agent: agentArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const hubConfig = getHubConfig(config);
		const { id, config: agentConfig } = getAgentConfig(config, args.agent);

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

		const { checkReporter } = await createHubReporters(id, getHubUrl(hubConfig));
		startAgent(id, agentConfig, config.providers ?? {}, checkReporter);
	}),
});
