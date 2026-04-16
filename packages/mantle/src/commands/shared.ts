import { type Config, type HubConfig, type AgentConfig, OperationalError } from "mantle-framework";

export function getHubConfig(config: Config): HubConfig {
	if (!config.hub) {
		throw new OperationalError("No hub defined in config");
	}
	return config.hub;
}

export function getHubUrl(hubConfig: HubConfig): string {
	const { ip, port } = hubConfig.listen;
	const host = ip.includes(":") ? `[${ip}]` : ip;
	return `http://${host}:${port}`;
}

export function getAgentConfig(
	config: Config,
	agent?: string,
): { id: string; config: AgentConfig } {
	const agents = getAllAgentConfigs(config);
	const availableIds = Object.keys(agents);

	if (availableIds.length === 0) {
		throw new OperationalError("No agent defined in config");
	}

	const id = agent ?? availableIds[0]!;
	const agentConfig = agents[id];

	if (!agentConfig) {
		throw new OperationalError(
			`Agent '${id}' not found. Available: ${availableIds.join(", ")}`,
		);
	}

	return { id, config: agentConfig };
}

export function getAllAgentConfigs(config: Config): Record<string, AgentConfig> {
	const agents: Record<string, AgentConfig> = {};
	if (config.agent) {
		agents["default"] = config.agent;
	}
	if (config.agents) {
		Object.assign(agents, config.agents);
	}
	return agents;
}

export const configArg = {
	type: "string",
	description: "Path to config file",
	default: "config.yaml",
} as const;

export const agentArg = {
	type: "string",
	description: "Agent ID from config (required when using 'agents')",
} as const;
