import type {
  CheckEventEndedRecord,
  CheckEventRecord,
  ProviderEventEndedRecord,
  ProviderEventRecord,
  TargetEventEndedRecord,
  TargetEventRecord,
} from "mantle-store";

export type ChannelOutboxPayload =
  | { type: "provider_event_started"; event: ProviderEventRecord }
  | { type: "provider_event_ended"; event: ProviderEventEndedRecord }
  | { type: "target_event_started"; event: TargetEventRecord }
  | { type: "target_event_ended"; event: TargetEventEndedRecord }
  | { type: "check_event_started"; event: CheckEventRecord }
  | { type: "check_event_ended"; event: CheckEventEndedRecord };
