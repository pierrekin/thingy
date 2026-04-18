import type { AgentConfig } from "mantle-framework";
import { validateAgentConfig } from "mantle-providers";

export type ResolvedAgentPayload = {
  agentConfig: AgentConfig;
  providerConfigs: Record<string, unknown>;
};

export class AgentConfigRegistry {
  private byId: Map<string, ResolvedAgentPayload>;

  constructor(payloads: Map<string, ResolvedAgentPayload>) {
    for (const { agentConfig, providerConfigs } of payloads.values()) {
      validateAgentConfig(agentConfig, providerConfigs);
    }
    this.byId = payloads;
  }

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
