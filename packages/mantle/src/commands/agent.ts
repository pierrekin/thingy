import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors, resolvePlacements, OperationalError } from "mantle-framework";
import { startTargets, createHubConnection } from "mantle-agent";
import { createChannelInstances, startChannelWorker, createSinkInstances, startSinkWorker } from "mantle-hub";
import { configArg, agentArg, getAgentConfig } from "./shared.ts";

export const agent = defineCommand({
	meta: { name: "agent", description: "Run agent" },
	args: { config: configArg, agent: agentArg, hub: { type: "string", description: "Hub URL" } },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const { id, config: agentConfig } = getAgentConfig(config, args.agent);

		if (!args.hub) {
			throw new OperationalError("Hub URL required (--hub)");
		}
		const hubUrl = args.hub;

		const connection = createHubConnection(id, hubUrl);
		const { instanceId, role } = await connection.waitForHello();

		console.log(`Assigned instance ${instanceId}, role: ${role}`);

		const channelConfigs = resolvePlacements(agentConfig.channels, config.channels);
		const sinkConfigs = resolvePlacements(agentConfig.sinks, config.sinks);

		function startWork() {
			console.log("Starting as leader...");
			startTargets(id, agentConfig, config.providers ?? {}, connection.checkReporter);

			for (const ch of createChannelInstances(channelConfigs)) {
				void startChannelWorker(hubUrl, ch.name, ch.instance);
			}

			for (const s of createSinkInstances(sinkConfigs)) {
				void startSinkWorker(hubUrl, s.name, s.instance);
			}
		}

		if (role === "leader") {
			startWork();
		} else {
			console.log("Standing by as standby...");
			connection.onPromote(() => {
				console.log("Promoted to leader");
				startWork();
			});
		}
	}),
});
