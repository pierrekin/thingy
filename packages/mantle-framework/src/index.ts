// Domain types
export type {
  OutcomeError,
  Violation,
  ProviderOutcome,
  TargetOutcome,
  CheckOutcome,
  ChannelOutcome,
  AgentOutcome,
  BucketStatus,
} from "./types.ts";

// Check definitions
export {
  defineCheck,
  checkConfigSchema,
  ENABLED,
  DISABLED,
  type CheckDefinition,
  type CheckConfig,
  type Operator,
  type EnumValues,
} from "./check.ts";

// Provider definitions
export {
  defineProvider,
  bindCheck,
  providerConfigSchema,
  targetConfigSchema,
  allTargetConfigsSchema,
  type ProviderDefinition,
  type TargetTypeDefinition,
  type CheckBinding,
} from "./provider.ts";

// Rules & evaluation
export { evaluate, resolveCheckConfig } from "./rules.ts";

// Config resolution
export { resolveAgentConfig, type ResolvedTarget, type ResolvedCheck } from "./resolve.ts";

// Check results
export { type CheckResult, isCheckError, isCheckSuccess } from "./result.ts";

// Protocol (agent <-> hub messages)
export type { CheckResultPayload, AgentMessage, HubMessage } from "./protocol.ts";

// Provider & channel interfaces
export type { ProviderInstance, Provider } from "./provider-interface.ts";
export type { ChannelInstance, Channel } from "./channel.ts";
export type { SinkInstance, SinkRecord, Sink } from "./sink.ts";

// Config
export { loadConfig, type Config, type HubConfig, type AgentConfig } from "./config.ts";

// Errors
export { OperationalError, handleOperationalErrors } from "./errors.ts";

// Utilities
export { parseInterval } from "./interval.ts";
