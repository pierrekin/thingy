import type {
  CheckEventEndedRecord,
  CheckEventRecord,
  ProviderEventEndedRecord,
  ProviderEventRecord,
  TargetEventEndedRecord,
  TargetEventRecord,
} from "mantle-store";
import type { z } from "zod";

export interface ChannelInstance {
  onProviderEventStarted(event: ProviderEventRecord): void;
  onProviderEventEnded(event: ProviderEventEndedRecord): void;
  onTargetEventStarted(event: TargetEventRecord): void;
  onTargetEventEnded(event: TargetEventEndedRecord): void;
  onCheckEventStarted(event: CheckEventRecord): void;
  onCheckEventEnded(event: CheckEventEndedRecord): void;
  close(): Promise<void>;
}

export interface Channel {
  name: string;
  configSchema: z.ZodType | null;
  createInstance(config: unknown): ChannelInstance;
}
