import type { ProviderEventRecord, TargetEventRecord, CheckEventRecord } from "mantle-store";

export type ChannelOutboxPayload =
  | { type: "provider_event_started"; event: ProviderEventRecord }
  | { type: "provider_event_ended"; event: ProviderEventRecord }
  | { type: "target_event_started"; event: TargetEventRecord }
  | { type: "target_event_ended"; event: TargetEventRecord }
  | { type: "check_event_started"; event: CheckEventRecord }
  | { type: "check_event_ended"; event: CheckEventRecord }
