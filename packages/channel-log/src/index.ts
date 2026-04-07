import { z } from "zod";
import type { ChannelInstance } from "mantle-framework";
import type {
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
} from "mantle-store";

const logChannelConfig = z.object({
	output: z.enum(["stdout", "stderr", "file"]).default("stdout"),
	path: z.string().optional(),
});

type LogChannelConfig = z.infer<typeof logChannelConfig>;

function ts(epoch: number): string {
	return new Date(epoch).toISOString();
}

class LogChannelInstance implements ChannelInstance {
	private config: LogChannelConfig;
	private fileWriter: ReturnType<ReturnType<typeof Bun.file>["writer"]> | null = null;

	constructor(config: LogChannelConfig) {
		if (config.output === "file" && !config.path) {
			throw new Error("channel-log: 'path' is required when output is 'file'");
		}
		this.config = config;
	}

	private write(line: string): void {
		if (this.config.output === "file") {
			if (!this.fileWriter) {
				this.fileWriter = Bun.file(this.config.path!).writer();
			}
			this.fileWriter.write(line + "\n");
			this.fileWriter.flush();
			return;
		}

		const stream = this.config.output === "stderr" ? process.stderr : process.stdout;
		stream.write(line + "\n");
	}

	onProviderEventStarted(event: ProviderEventRecord): void {
		this.write(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onProviderEventEnded(event: ProviderEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.write(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} code=${event.code} duration=${duration}ms`,
		);
	}

	onTargetEventStarted(event: TargetEventRecord): void {
		this.write(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} target=${event.target} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onTargetEventEnded(event: TargetEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.write(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} target=${event.target} code=${event.code} duration=${duration}ms`,
		);
	}

	onCheckEventStarted(event: CheckEventRecord): void {
		this.write(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} target=${event.target} check=${event.check} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onCheckEventEnded(event: CheckEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.write(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} target=${event.target} check=${event.check} code=${event.code} duration=${duration}ms`,
		);
	}
}

export default {
	name: "log",
	configSchema: logChannelConfig,
	createInstance: (config: unknown) =>
		new LogChannelInstance(logChannelConfig.parse(config ?? {})),
} satisfies import("mantle-framework").Channel;
