import { z } from "zod";
import { renameSync } from "node:fs";
import type { Channel, ChannelInstance } from "mantle-framework";
import type {
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
} from "mantle-store";

function iso(epoch: number): string {
	return new Date(epoch).toISOString();
}

function parseSize(s: string): number {
	const match = s.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i);
	if (!match) throw new Error(`Invalid maxSize value: "${s}"`);
	const value = parseFloat(match[1]);
	const unit = match[2].toLowerCase();
	const multipliers: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
	return Math.floor(value * multipliers[unit]);
}

function parseDuration(s: string): number {
	const match = s.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
	if (!match) throw new Error(`Invalid maxAge value: "${s}"`);
	const value = parseFloat(match[1]);
	const unit = match[2].toLowerCase();
	const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return Math.floor(value * multipliers[unit]);
}

type FileSink = ReturnType<ReturnType<typeof Bun.file>["writer"]>;

function rotate(path: string, writer: FileSink, suffix: string): FileSink {
	writer.end();
	renameSync(path, `${path}.${suffix}`);
	return Bun.file(path).writer();
}

type Notification = {
	type: string;
	time: string;
	started_at: string;
	ended_at?: string;
	provider: string;
	target?: string;
	check?: string;
	code: string;
	title: string;
	message: string;
};

function formatText(n: Notification): string {
	const parts: string[] = [`[${n.time}]`, n.type.replace(/_/g, " ").toUpperCase()];
	parts.push(`provider=${n.provider}`);
	if (n.target !== undefined) parts.push(`target=${n.target}`);
	if (n.check !== undefined) parts.push(`check=${n.check}`);
	parts.push(`code=${n.code}`);
	parts.push(`started_at="${n.started_at}"`);
	if (n.ended_at !== undefined) parts.push(`ended_at="${n.ended_at}"`);
	parts.push(`title="${n.title}"`);
	parts.push(`message="${n.message}"`);
	return parts.join(" ");
}

function formatJson(n: Notification): string {
	return JSON.stringify(n);
}

class LogChannelInstance implements ChannelInstance {
	private format: (n: Notification) => string;

	constructor(
		private writeLine: (line: string) => void,
		format: "text" | "json",
	) {
		this.format = format === "json" ? formatJson : formatText;
	}

	onProviderEventStarted(event: ProviderEventRecord): void {
		this.writeLine(this.format({
			type: "provider_event_started",
			time: iso(event.startTime),
			started_at: iso(event.startTime),
			provider: event.provider,
			code: event.code,
			title: event.title,
			message: event.message,
		}));
	}

	onProviderEventEnded(event: ProviderEventRecord): void {
		this.writeLine(this.format({
			type: "provider_event_ended",
			time: iso(event.endTime!),
			started_at: iso(event.startTime),
			ended_at: iso(event.endTime!),
			provider: event.provider,
			code: event.code,
			title: event.title,
			message: event.message,
		}));
	}

	onTargetEventStarted(event: TargetEventRecord): void {
		this.writeLine(this.format({
			type: "target_event_started",
			time: iso(event.startTime),
			started_at: iso(event.startTime),
			provider: event.provider,
			target: event.target,
			code: event.code,
			title: event.title,
			message: event.message,
		}));
	}

	onTargetEventEnded(event: TargetEventRecord): void {
		this.writeLine(this.format({
			type: "target_event_ended",
			time: iso(event.endTime!),
			started_at: iso(event.startTime),
			ended_at: iso(event.endTime!),
			provider: event.provider,
			target: event.target,
			code: event.code,
			title: event.title,
			message: event.message,
		}));
	}

	onCheckEventStarted(event: CheckEventRecord): void {
		this.writeLine(this.format({
			type: "check_event_started",
			time: iso(event.startTime),
			started_at: iso(event.startTime),
			provider: event.provider,
			target: event.target,
			check: event.check,
			code: event.code,
			title: event.title,
			message: event.message,
		}));
	}

	onCheckEventEnded(event: CheckEventRecord): void {
		this.writeLine(this.format({
			type: "check_event_ended",
			time: iso(event.endTime!),
			started_at: iso(event.startTime),
			ended_at: iso(event.endTime!),
			provider: event.provider,
			target: event.target,
			check: event.check,
			code: event.code,
			title: event.title,
			message: event.message,
		}));
	}
}

const logConfig = z.object({
	format: z.enum(["text", "json"]).default("text"),
});

const fileConfig = logConfig.extend({
	path: z.string(),
	maxSize: z.string().optional(),
	maxAge: z.string().optional(),
});

const stdoutChannel: Channel = {
	name: "@mantle/log/stdout",
	configSchema: logConfig,
	createInstance: (config) => {
		const { format } = logConfig.parse(config ?? {});
		return new LogChannelInstance((line) => process.stdout.write(line + "\n"), format);
	},
};

const stderrChannel: Channel = {
	name: "@mantle/log/stderr",
	configSchema: logConfig,
	createInstance: (config) => {
		const { format } = logConfig.parse(config ?? {});
		return new LogChannelInstance((line) => process.stderr.write(line + "\n"), format);
	},
};

const fileChannel: Channel = {
	name: "@mantle/log/file",
	configSchema: fileConfig,
	createInstance: (config: unknown) => {
		const { path, format, maxSize, maxAge } = fileConfig.parse(config);
		const maxBytes = maxSize ? parseSize(maxSize) : null;
		const maxAgeMs = maxAge ? parseDuration(maxAge) : null;

		let writer = Bun.file(path).writer();
		let bytesWritten = 0;
		let openedAt = Date.now();

		return new LogChannelInstance((line) => {
			const data = line + "\n";
			const now = Date.now();
			const suffix = new Date(now).toISOString().replace(/[:.]/g, "-");

			if (maxAgeMs !== null && now - openedAt >= maxAgeMs) {
				writer = rotate(path, writer, suffix);
				bytesWritten = 0;
				openedAt = now;
			}

			if (maxBytes !== null && bytesWritten + data.length > maxBytes) {
				writer = rotate(path, writer, suffix);
				bytesWritten = 0;
				openedAt = now;
			}

			writer.write(data);
			writer.flush();
			bytesWritten += data.length;
		}, format);
	},
};

export const channels: Channel[] = [stdoutChannel, stderrChannel, fileChannel];
