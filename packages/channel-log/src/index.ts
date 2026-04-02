import { z } from "zod";
import type { ChannelInstance } from "../../mantle/src/channel.ts";
import type {
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
} from "../../mantle/src/store/types.ts";

const logChannelConfig = z.object({
	output: z.enum(["stdout", "stderr", "file"]).default("stdout"),
	path: z.string().optional(),
});

type LogChannelConfig = z.infer<typeof logChannelConfig>;

type Writer = {
	write(line: string): void;
};

function createWriter(config: LogChannelConfig): Writer {
	if (config.output === "file") {
		if (!config.path) {
			throw new Error("channel-log: 'path' is required when output is 'file'");
		}
		const file = Bun.file(config.path);
		const writer = file.writer();
		return {
			write(line: string) {
				writer.write(line + "\n");
				writer.flush();
			},
		};
	}

	const stream = config.output === "stderr" ? process.stderr : process.stdout;
	return {
		write(line: string) {
			stream.write(line + "\n");
		},
	};
}

function ts(epoch: number): string {
	return new Date(epoch).toISOString();
}

class LogChannelInstance implements ChannelInstance {
	private writer: Writer;

	constructor(config: LogChannelConfig) {
		this.writer = createWriter(config);
	}

	onProviderEventStarted(event: ProviderEventRecord): void {
		this.writer.write(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onProviderEventEnded(event: ProviderEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.writer.write(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} code=${event.code} duration=${duration}ms`,
		);
	}

	onTargetEventStarted(event: TargetEventRecord): void {
		this.writer.write(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} target=${event.target} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onTargetEventEnded(event: TargetEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.writer.write(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} target=${event.target} code=${event.code} duration=${duration}ms`,
		);
	}

	onCheckEventStarted(event: CheckEventRecord): void {
		this.writer.write(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} target=${event.target} check=${event.check} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onCheckEventEnded(event: CheckEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.writer.write(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} target=${event.target} check=${event.check} code=${event.code} duration=${duration}ms`,
		);
	}
}

export default {
	name: "log",
	configSchema: logChannelConfig,
	createInstance: (config: unknown) =>
		new LogChannelInstance(logChannelConfig.parse(config ?? {})),
} satisfies import("../../mantle/src/channel.ts").Channel;
