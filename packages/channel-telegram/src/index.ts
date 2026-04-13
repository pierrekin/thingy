import { z } from "zod";
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

function escape(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildMessage(params: {
	title: string;
	provider: string;
	target?: string;
	check?: string;
	code: string;
	startTime: number;
	endTime?: number;
	message: string;
}): string {
	const lines: string[] = [`<b>${escape(params.title)}</b>`, ""];
	lines.push(`provider: ${escape(params.provider)}`);
	if (params.target !== undefined) lines.push(`target: ${escape(params.target)}`);
	if (params.check !== undefined) lines.push(`check: ${escape(params.check)}`);
	lines.push(`code: ${escape(params.code)}`);
	lines.push(`started_at: ${iso(params.startTime)}`);
	if (params.endTime !== undefined) lines.push(`ended_at: ${iso(params.endTime)}`);
	lines.push("", escape(params.message));
	return lines.join("\n");
}

class TelegramBotChannelInstance implements ChannelInstance {
	private pending = new Set<Promise<void>>();

	constructor(
		private token: string,
		private chatId: string,
		private timeoutMs: number,
	) {}

	private send(text: string): void {
		const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const p = fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: "HTML" }),
			signal: controller.signal,
		})
			.then((res) => {
				if (!res.ok) {
					process.stderr.write(`[telegram] sendMessage failed: ${res.status} ${res.statusText}\n`);
				}
			})
			.catch((err: Error) => {
				process.stderr.write(`[telegram] sendMessage error: ${err.message}\n`);
			})
			.finally(() => {
				clearTimeout(timer);
				this.pending.delete(p);
			});
		this.pending.add(p);
	}

	onProviderEventStarted(event: ProviderEventRecord): void {
		this.send(buildMessage({
			title: event.title,
			provider: event.provider,
			code: event.code,
			startTime: event.startTime,
			message: event.message,
		}));
	}

	onProviderEventEnded(event: ProviderEventRecord): void {
		this.send(buildMessage({
			title: event.title,
			provider: event.provider,
			code: event.code,
			startTime: event.startTime,
			endTime: event.endTime!,
			message: event.message,
		}));
	}

	onTargetEventStarted(event: TargetEventRecord): void {
		this.send(buildMessage({
			title: event.title,
			provider: event.provider,
			target: event.target,
			code: event.code,
			startTime: event.startTime,
			message: event.message,
		}));
	}

	onTargetEventEnded(event: TargetEventRecord): void {
		this.send(buildMessage({
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
		this.send(buildMessage({
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
		this.send(buildMessage({
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
	}
}

const telegramConfig = z.object({
	token: z.string(),
	chat_id: z.string(),
	timeout: z.string().optional(),
});

const telegramBotChannel: Channel = {
	name: "@mantle/telegram/bot",
	configSchema: telegramConfig,
	createInstance: (config: unknown) => {
		const { token, chat_id, timeout } = telegramConfig.parse(config);
		const timeoutMs = timeout ? parseDuration(timeout) : 30_000;
		return new TelegramBotChannelInstance(token, chat_id, timeoutMs);
	},
};

export const channels: Channel[] = [telegramBotChannel];
