import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors, resolvePlacements, OperationalError } from "mantle-framework";
import { startTargets, createHubReporters } from "mantle-agent";
import { createChannelInstances, startChannelWorker, createSinkInstances, startSinkWorker } from "mantle-hub";
import { configArg, agentArg, getAgentConfig } from "./shared.ts";

export const agent = defineCommand({
	meta: { name: "agent", description: "Run agent" },
	args: { config: configArg, agent: agentArg, hub: { type: "string", description: "Hub URL" } },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const { id, config: agentConfig } = getAgentConfig(config, args.agent);

		const hubUrl = args.hub;
		if (!hubUrl) {
			throw new OperationalError("Hub URL required (--hub)");
		}

		const { checkReporter } = await createHubReporters(id, hubUrl);
		startTargets(id, agentConfig, config.providers ?? {}, checkReporter);

		const channelConfigs = resolvePlacements(agentConfig.channels, config.channels);
		const sinkConfigs = resolvePlacements(agentConfig.sinks, config.sinks);

		for (const ch of createChannelInstances(channelConfigs)) {
			void startChannelWorker(hubUrl, ch.name, ch.instance);
		}

		for (const s of createSinkInstances(sinkConfigs)) {
			void startSinkWorker(hubUrl, s.name, s.instance);
		}
	}),
});
