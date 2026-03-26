import { defineCommand } from "citty";
import {
	loadConfig,
	type Config,
	type HubConfig,
	type AgentConfig,
} from "./config.ts";
import { handleOperationalErrors, OperationalError } from "./errors.ts";
import { startHub } from "./hub/index.ts";
import { startAgent } from "./agent/index.ts";

function getHubConfig(config: Config): HubConfig {
	if (!config.hub) {
		throw new OperationalError("No hub defined in config");
	}
	return config.hub;
}

function getAgentConfig(
	config: Config,
	agent?: string,
): { id: string; config: AgentConfig } {
	// Build map of available agents
	const agents: Record<string, AgentConfig> = {};

	if (config.agent) {
		agents["default"] = config.agent;
	}

	if (config.agents) {
		Object.assign(agents, config.agents);
	}

	const availableIds = Object.keys(agents);

	if (availableIds.length === 0) {
		throw new OperationalError("No agent defined in config");
	}

	// Default to first available if not specified
	const id = agent ?? availableIds[0]!;
	const agentConfig = agents[id];

	if (!agentConfig) {
		throw new OperationalError(
			`Agent '${id}' not found. Available: ${availableIds.join(", ")}`,
		);
	}

	return { id, config: agentConfig };
}

const configArg = {
	type: "string",
	description: "Path to config file",
	default: "config.yaml",
} as const;

const agentArg = {
	type: "string",
	description: "Agent ID from config (required when using 'agents')",
} as const;

const hub = defineCommand({
	meta: { name: "hub", description: "Run hub" },
	args: { config: configArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		startHub(getHubConfig(config));
	}),
});

const agent = defineCommand({
	meta: { name: "agent", description: "Run agent" },
	args: { config: configArg, agent: agentArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const { id, config: agentConfig } = getAgentConfig(config, args.agent);
		startAgent(id, agentConfig, config.providers ?? {});
	}),
});

const standalone = defineCommand({
	meta: { name: "standalone", description: "Run standalone" },
	args: { config: configArg, agent: agentArg },
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);
		const { id, config: agentConfig } = getAgentConfig(config, args.agent);
		startHub(getHubConfig(config));
		startAgent(id, agentConfig, config.providers ?? {});
	}),
});

export const main = defineCommand({
	meta: {
		name: "mantle",
		version: "0.0.2",
		description: "Mantle CLI",
	},
	subCommands: {
		hub,
		agent,
		standalone,
	},
});
