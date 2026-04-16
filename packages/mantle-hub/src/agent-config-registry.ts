import type { AgentConfig } from "mantle-framework";

export type ResolvedAgentPayload = {
	agentConfig: AgentConfig;
	providerConfigs: Record<string, unknown>;
};

export class AgentConfigRegistry {
	constructor(private byId: Map<string, ResolvedAgentPayload>) {}

	get(agentId: string): ResolvedAgentPayload | undefined {
		return this.byId.get(agentId);
	}

	has(agentId: string): boolean {
		return this.byId.has(agentId);
	}

	knownIds(): string[] {
		return Array.from(this.byId.keys());
	}
}
