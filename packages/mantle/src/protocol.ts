import type { OutcomeError, Violation } from "./store/types.ts";

export type CheckResultPayload =
  | { ok: true; measurement: number; violation?: Violation }
  | { ok: false; error: OutcomeError };

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
    }
  | {
      type: "ack";
    };
