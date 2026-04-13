import { z } from "zod";
import type { Channel, ChannelInstance } from "mantle-framework";
import type {
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
} from "mantle-store";

function ts(epoch: number): string {
	return new Date(epoch).toISOString();
}

class LogChannelInstance implements ChannelInstance {
	constructor(private writeLine: (line: string) => void) {}

	onProviderEventStarted(event: ProviderEventRecord): void {
		this.writeLine(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onProviderEventEnded(event: ProviderEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.writeLine(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} code=${event.code} duration=${duration}ms`,
		);
	}

	onTargetEventStarted(event: TargetEventRecord): void {
		this.writeLine(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} target=${event.target} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onTargetEventEnded(event: TargetEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.writeLine(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} target=${event.target} code=${event.code} duration=${duration}ms`,
		);
	}

	onCheckEventStarted(event: CheckEventRecord): void {
		this.writeLine(
			`[${ts(event.startTime)}] EVENT STARTED provider=${event.provider} target=${event.target} check=${event.check} code=${event.code} title="${event.title}" message="${event.message}"`,
		);
	}

	onCheckEventEnded(event: CheckEventRecord): void {
		const duration = event.endTime! - event.startTime;
		this.writeLine(
			`[${ts(event.endTime!)}] EVENT ENDED provider=${event.provider} target=${event.target} check=${event.check} code=${event.code} duration=${duration}ms`,
		);
	}
}

const logFileConfig = z.object({
	path: z.string(),
});

const stdoutChannel: Channel = {
	name: "@mantle/log/stdout",
	configSchema: null,
	createInstance: () =>
		new LogChannelInstance((line) => process.stdout.write(line + "\n")),
};

const stderrChannel: Channel = {
	name: "@mantle/log/stderr",
	configSchema: null,
	createInstance: () =>
		new LogChannelInstance((line) => process.stderr.write(line + "\n")),
};

const fileChannel: Channel = {
	name: "@mantle/log/file",
	configSchema: logFileConfig,
	createInstance: (config: unknown) => {
		const { path } = logFileConfig.parse(config);
		const writer = Bun.file(path).writer();
		return new LogChannelInstance((line) => {
			writer.write(line + "\n");
			writer.flush();
		});
	},
};

export const channels: Channel[] = [stdoutChannel, stderrChannel, fileChannel];
