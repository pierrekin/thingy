import type { z } from "zod";
import type {
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
} from "mantle-store";

export interface ChannelInstance {
	onProviderEventStarted(event: ProviderEventRecord): void;
	onProviderEventEnded(event: ProviderEventRecord): void;
	onTargetEventStarted(event: TargetEventRecord): void;
	onTargetEventEnded(event: TargetEventRecord): void;
	onCheckEventStarted(event: CheckEventRecord): void;
	onCheckEventEnded(event: CheckEventRecord): void;
	close(): Promise<void>;
}

export interface Channel {
	name: string;
	configSchema: z.ZodType | null;
	createInstance(config: unknown): ChannelInstance;
}
