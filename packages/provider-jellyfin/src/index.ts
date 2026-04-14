import { z } from "zod";
import {
	defineCheck,
	defineProvider,
	bindCheck,
	providerConfigSchema,
	allTargetConfigsSchema,
	type CheckResult,
	type Provider,
} from "mantle-framework";
import { JellyfinClient, JellyfinApiError } from "./client.ts";

// --- Helpers ---

function parseDuration(s: string): number {
	const match = s.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
	if (!match) throw new Error(`Invalid timeout value: "${s}"`);
	const value = parseFloat(match[1]!);
	const unit = match[2]!.toLowerCase();
	const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return Math.floor(value * multipliers[unit]!);
}

// --- Config ---

const jellyfinConfig = z.object({
	url: z.string(),
	api_key: z.string(),
	timeout: z.string().optional(),
});

// --- Error titles ---

const ERROR_TITLES: Record<string, string> = {
	unreachable: "Cannot connect",
	auth_failed: "Authentication failed",
	api_error: "API error",
	not_found: "Not found",
};

function errorTitle(code: string): string {
	return ERROR_TITLES[code] ?? code;
}

// --- Checks ---

const sessionsCheck = defineCheck({
	name: "sessions",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

// --- Provider definition ---

const jellyfinProvider = defineProvider({
	name: "@mantle/jellyfin/remote",
	config: jellyfinConfig,
	defaultInterval: "1m",
	targetTypes: {
		health: {
			schema: z.object({}),
			checks: {
				sessions: bindCheck(sessionsCheck),
			},
			defaultInterval: "1m",
		},
	},
});

// --- Provider instance ---

class JellyfinProviderInstance {
	private client: JellyfinClient;

	constructor(config: { url: string; api_key: string; timeoutMs: number }) {
		this.client = new JellyfinClient(config.url, config.api_key, config.timeoutMs);
	}

	getErrorTitle(code: string): string {
		return errorTitle(code);
	}

	async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
		const t = target as { type: string };
		switch (t.type) {
			case "health": return this.checkHealth(checks);
			default: throw new Error(`Unknown target type: ${t.type}`);
		}
	}

	private async checkHealth(checks: string[]): Promise<CheckResult[]> {
		let sessions: Awaited<ReturnType<typeof this.client.getSessions>>;
		try {
			sessions = await this.client.getSessions();
		} catch (err) {
			if (err instanceof JellyfinApiError) {
				return checks.map((check) => ({
					check,
					error: { level: "provider" as const, code: err.code, title: errorTitle(err.code), message: err.message },
				}));
			}
			const message = err instanceof Error ? err.message : String(err);
			return checks.map((check) => ({
				check,
				error: { level: "check" as const, code: "unknown", title: "Unknown error", message },
			}));
		}

		return checks.map((check) => {
			switch (check) {
				case "sessions": return { check, value: sessions.length };
				default: return {
					check,
					error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` },
				};
			}
		});
	}
}

// --- Export ---

function makeInstance(config: unknown): { url: string; api_key: string; timeoutMs: number } {
	const { url, api_key, timeout } = jellyfinConfig.parse(config);
	return { url, api_key, timeoutMs: timeout ? parseDuration(timeout) : 30_000 };
}

const jellyfinRemote = {
	name: jellyfinProvider.name,
	definition: jellyfinProvider,
	providerConfigSchema: providerConfigSchema(jellyfinProvider.config, jellyfinProvider.targetTypes, jellyfinProvider.name),
	targetConfigSchema: allTargetConfigsSchema(jellyfinProvider.targetTypes),
	createInstance: (config: unknown) => new JellyfinProviderInstance(makeInstance(config)),
} satisfies Provider;

export const providers: Provider[] = [jellyfinRemote];
