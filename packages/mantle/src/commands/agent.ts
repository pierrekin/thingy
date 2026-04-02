import { defineCommand } from "citty";
import { loadConfig } from "../config.ts";
import { handleOperationalErrors, OperationalError } from "../errors.ts";
import { startAgent } from "../agent/index.ts";
import { createHubReporters } from "../agent/hub-client.ts";
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
		startAgent(id, agentConfig, config.providers ?? {}, checkReporter);
	}),
});
