// Domain types

export type { Channel, ChannelInstance } from "./channel.ts";

// Check definitions
export {
  type CheckConfig,
  type CheckDefinition,
  checkConfigSchema,
  DISABLED,
  defineCheck,
  ENABLED,
  type EnumValues,
  type Operator,
} from "./check.ts";
// Config
export {
  type AgentConfig,
  type Config,
  type HubConfig,
  loadConfig,
  type TargetConfig,
} from "./config.ts";
// Utilities
export { duration, parseDuration } from "./duration.ts";
// Errors
export { InvariantError, invariant, OperationalError } from "./errors.ts";
// Process
export { spawn } from "./process.ts";
// Protocol (agent <-> hub messages)
export type {
  AgentMessage,
  CheckResultPayload,
  HubMessage,
} from "./protocol.ts";
// Provider definitions
export {
  allTargetConfigsSchema,
  bindCheck,
  type CheckBinding,
  defineProvider,
  type ProviderDefinition,
  providerConfigSchema,
  type TargetTypeDefinition,
  targetConfigSchema,
} from "./provider.ts";

// Provider & channel interfaces
export type { Provider, ProviderInstance } from "./provider-interface.ts";
// Config resolution
export {
  type ResolvedCheck,
  type ResolvedTarget,
  resolveAgentConfig,
} from "./resolve.ts";
// Check results
export { type CheckResult, isCheckError, isCheckSuccess } from "./result.ts";
// Rules & evaluation
export { evaluate, resolveCheckConfig } from "./rules.ts";
export type { Sink, SinkInstance, SinkRecord } from "./sink.ts";
export type {
  AgentOutcome,
  BucketStatus,
  ChannelOutcome,
  CheckOutcome,
  OutcomeError,
  ProviderOutcome,
  TargetOutcome,
  Violation,
} from "./types.ts";
