import type { AgentConfig } from "./config.ts";
import type { OutcomeError, Violation } from "./types.ts";

export type CheckResultPayload =
  | { status: "compliant"; measurement: number }
  | { status: "violation"; measurement: number; violation: Violation }
  | { status: "error"; error: OutcomeError };

export type AgentMessage =
  | {
      type: "check_result";
      provider: string;
      target: string;
      check: string;
      time: number;
      result: CheckResultPayload;
    }
  | {
      type: "agent_hello";
      agentId: string;
    };

export type HubMessage =
  | {
      type: "hub_hello";
      instanceId: string;
      role: "leader" | "standby";
      agentConfig: AgentConfig;
      providerConfigs: Record<string, unknown>;
    }
  | {
      type: "agent_reject";
      reason: string;
      code: "unknown_agent";
    }
  | {
      type: "agent_promote";
      instanceId: string;
    }
  | {
      type: "ack";
    };
