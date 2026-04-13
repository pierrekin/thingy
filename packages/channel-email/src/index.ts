import { z } from "zod";
import nodemailer from "nodemailer";
import type { Channel, ChannelInstance } from "mantle-framework";
import type {
	ProviderEventRecord,
	TargetEventRecord,
	CheckEventRecord,
} from "mantle-store";

function iso(epoch: number): string {
	return new Date(epoch).toISOString();
}

function parseDuration(s: string): number {
	const match = s.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
	if (!match) throw new Error(`Invalid timeout value: "${s}"`);
	const value = parseFloat(match[1]!);
	const unit = match[2]!.toLowerCase();
	const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return Math.floor(value * multipliers[unit]!);
}

function buildBody(params: {
	title: string;
	provider: string;
	target?: string;
	check?: string;
	code: string;
	startTime: number;
	endTime?: number;
	message: string;
}): string {
	const lines: string[] = [params.title, ""];
	lines.push(`provider: ${params.provider}`);
	if (params.target !== undefined) lines.push(`target: ${params.target}`);
	if (params.check !== undefined) lines.push(`check: ${params.check}`);
	lines.push(`code: ${params.code}`);
	lines.push(`started_at: ${iso(params.startTime)}`);
	if (params.endTime !== undefined) lines.push(`ended_at: ${iso(params.endTime)}`);
	lines.push("", params.message);
	return lines.join("\n");
}

class SmtpSendChannelInstance implements ChannelInstance {
	private pending = new Set<Promise<void>>();
	private transport: nodemailer.Transporter;

	constructor(
		private from: string,
		private to: string | string[],
		private subjectPrefix: string,
		private timeoutMs: number,
		transportOptions: object,
	) {
		this.transport = nodemailer.createTransport(transportOptions);
	}

	private send(subject: string, text: string): void {
		const p = Promise.race([
			this.transport.sendMail({
				from: this.from,
				to: this.to,
				subject: `${this.subjectPrefix} ${subject}`,
				text,
			}).then(() => {}),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("SMTP timeout")), this.timeoutMs)
			),
		])
			.catch((err: Error) => {
				process.stderr.write(`[smtp] sendMail error: ${err.message}\n`);
			})
			.finally(() => {
				this.pending.delete(p);
			});
		this.pending.add(p);
	}

	onProviderEventStarted(event: ProviderEventRecord): void {
		this.send(event.title, buildBody({
			title: event.title,
			provider: event.provider,
			code: event.code,
			startTime: event.startTime,
			message: event.message,
		}));
	}

	onProviderEventEnded(event: ProviderEventRecord): void {
		this.send(event.title, buildBody({
			title: event.title,
			provider: event.provider,
			code: event.code,
			startTime: event.startTime,
			endTime: event.endTime!,
			message: event.message,
		}));
	}

	onTargetEventStarted(event: TargetEventRecord): void {
		this.send(event.title, buildBody({
			title: event.title,
			provider: event.provider,
			target: event.target,
			code: event.code,
			startTime: event.startTime,
			message: event.message,
		}));
	}

	onTargetEventEnded(event: TargetEventRecord): void {
		this.send(event.title, buildBody({
			title: event.title,
			provider: event.provider,
			target: event.target,
			code: event.code,
			startTime: event.startTime,
			endTime: event.endTime!,
			message: event.message,
		}));
	}

	onCheckEventStarted(event: CheckEventRecord): void {
		this.send(event.title, buildBody({
			title: event.title,
			provider: event.provider,
			target: event.target,
			check: event.check,
			code: event.code,
			startTime: event.startTime,
			message: event.message,
		}));
	}

	onCheckEventEnded(event: CheckEventRecord): void {
		this.send(event.title, buildBody({
			title: event.title,
			provider: event.provider,
			target: event.target,
			check: event.check,
			code: event.code,
			startTime: event.startTime,
			endTime: event.endTime!,
			message: event.message,
		}));
	}

	async close(): Promise<void> {
		await Promise.all(this.pending);
		this.transport.close();
	}
}

const smtpConfig = z.object({
	host: z.string(),
	port: z.number().int().min(1).max(65535).optional(),
	secure: z.boolean().optional(),
	auth: z.object({
		user: z.string(),
		pass: z.string(),
	}).optional(),
	from: z.string(),
	to: z.union([z.string(), z.array(z.string())]),
	subject_prefix: z.string().optional(),
	timeout: z.string().optional(),
});

const smtpSendChannel: Channel = {
	name: "@mantle/email/smtp",
	configSchema: smtpConfig,
	createInstance: (config: unknown) => {
		const { host, port, secure, auth, from, to, subject_prefix, timeout } = smtpConfig.parse(config);
		const timeoutMs = timeout ? parseDuration(timeout) : 30_000;
		const subjectPrefix = subject_prefix ?? "[Mantle]";
		const transportOptions = {
			host,
			port,
			secure: secure ?? false,
			auth,
			connectionTimeout: timeoutMs,
			socketTimeout: timeoutMs,
		};
		return new SmtpSendChannelInstance(from, to, subjectPrefix, timeoutMs, transportOptions);
	},
};

export const channels: Channel[] = [smtpSendChannel];
