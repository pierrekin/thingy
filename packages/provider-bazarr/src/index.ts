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
import { BazarrClient, BazarrApiError } from "./client.ts";

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

const bazarrConfig = z.object({
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

const healthIssuesCheck = defineCheck({
	name: "issues",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

const wantedCountCheck = defineCheck({
	name: "count",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

// --- Error helpers ---

function providerError(checks: string[], err: BazarrApiError): CheckResult[] {
	return checks.map((check) => ({
		check,
		error: { level: "provider" as const, code: err.code, title: errorTitle(err.code), message: err.message },
	}));
}

function unknownError(checks: string[], err: unknown): CheckResult[] {
	const message = err instanceof Error ? err.message : String(err);
	return checks.map((check) => ({
		check,
		error: { level: "check" as const, code: "unknown", title: "Unknown error", message },
	}));
}

// --- Provider definition ---

const bazarrProvider = defineProvider({
	name: "@mantle/bazarr/remote",
	config: bazarrConfig,
	defaultInterval: "5m",
	targetTypes: {
		health: {
			schema: z.object({}),
			checks: {
				issues: bindCheck(healthIssuesCheck),
			},
			defaultInterval: "5m",
		},
		wanted_movies: {
			schema: z.object({}),
			checks: {
				count: bindCheck(wantedCountCheck),
			},
			defaultInterval: "5m",
		},
		wanted_episodes: {
			schema: z.object({}),
			checks: {
				count: bindCheck(wantedCountCheck),
			},
			defaultInterval: "5m",
		},
	},
});

// --- Provider instance ---

class BazarrProviderInstance {
	private client: BazarrClient;
	constructor(private config: { url: string; api_key: string; timeoutMs: number }) {
		this.client = new BazarrClient(config.url, config.api_key, config.timeoutMs);
	}

	getErrorTitle(code: string): string {
		return errorTitle(code);
	}

	async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
		const t = target as { type: string };
		switch (t.type) {
			case "health": return this.checkHealth(checks);
			case "wanted_movies": return this.checkWantedMovies(checks);
			case "wanted_episodes": return this.checkWantedEpisodes(checks);
			default: throw new Error(`Unknown target type: ${t.type}`);
		}
	}

	private async checkHealth(checks: string[]): Promise<CheckResult[]> {
		let health: Awaited<ReturnType<typeof this.client.getHealth>>;
		try {
			health = await this.client.getHealth();
		} catch (err) {
			if (err instanceof BazarrApiError) return providerError(checks, err);
			return unknownError(checks, err);
		}
		const issues = health.length;
		return checks.map((check) => {
			switch (check) {
				case "issues": return { check, value: issues };
				default: return { check, error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` } };
			}
		});
	}

	private async checkWantedMovies(checks: string[]): Promise<CheckResult[]> {
		let result: Awaited<ReturnType<typeof this.client.getWantedMovies>>;
		try {
			result = await this.client.getWantedMovies();
		} catch (err) {
			if (err instanceof BazarrApiError) return providerError(checks, err);
			return unknownError(checks, err);
		}
		return checks.map((check) => {
			switch (check) {
				case "count": return { check, value: result.total };
				default: return { check, error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` } };
			}
		});
	}

	private async checkWantedEpisodes(checks: string[]): Promise<CheckResult[]> {
		let result: Awaited<ReturnType<typeof this.client.getWantedEpisodes>>;
		try {
			result = await this.client.getWantedEpisodes();
		} catch (err) {
			if (err instanceof BazarrApiError) return providerError(checks, err);
			return unknownError(checks, err);
		}
		return checks.map((check) => {
			switch (check) {
				case "count": return { check, value: result.total };
				default: return { check, error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` } };
			}
		});
	}
}

// --- Export ---

function makeInstance(config: unknown): { url: string; api_key: string; timeoutMs: number } {
	const { url, api_key, timeout } = bazarrConfig.parse(config);
	return { url, api_key, timeoutMs: timeout ? parseDuration(timeout) : 30_000 };
}

const bazarrRemote = {
	name: bazarrProvider.name,
	definition: bazarrProvider,
	providerConfigSchema: providerConfigSchema(bazarrProvider.config, bazarrProvider.targetTypes, bazarrProvider.name),
	targetConfigSchema: allTargetConfigsSchema(bazarrProvider.targetTypes),
	createInstance: (config: unknown) => new BazarrProviderInstance(makeInstance(config)),
} satisfies Provider;

export const providers: Provider[] = [bazarrRemote];
