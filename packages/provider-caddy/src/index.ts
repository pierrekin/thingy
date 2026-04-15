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
import { CaddyClient, CaddyApiError } from "./client.ts";

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

const caddyConfig = z.object({
	url: z.string(),
	timeout: z.string().optional(),
});

// --- Error titles ---

const ERROR_TITLES: Record<string, string> = {
	unreachable: "Cannot connect",
	api_error: "API error",
	metric_absent: "Metric not available",
	upstream_not_found: "Upstream not found",
};

function errorTitle(code: string): string {
	return ERROR_TITLES[code] ?? code;
}

// --- Checks ---

const configReloadSuccessCheck = defineCheck({
	name: "config_reload_success",
	measurement: z.object({ success: z.number() }),
	operators: ["min"] as const,
	defaults: { min: 1 },
});

const numRequestsCheck = defineCheck({
	name: "num_requests",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 100 },
});

const failsCheck = defineCheck({
	name: "fails",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

// --- Provider definition ---

const caddyProvider = defineProvider({
	name: "@mantle/caddy/remote",
	config: caddyConfig,
	defaultInterval: "1m",
	targetTypes: {
		server: {
			schema: z.object({}),
			checks: {
				config_reload_success: bindCheck(configReloadSuccessCheck),
			},
			defaultInterval: "1m",
		},
		upstream: {
			schema: z.object({ address: z.string() }),
			checks: {
				num_requests: bindCheck(numRequestsCheck),
				fails: bindCheck(failsCheck),
			},
			defaultInterval: "1m",
		},
	},
});

// --- Provider instance ---

class CaddyProviderInstance {
	private client: CaddyClient;

	constructor(config: { url: string; timeoutMs: number }) {
		this.client = new CaddyClient(config.url, config.timeoutMs);
	}

	getErrorTitle(code: string): string {
		return errorTitle(code);
	}

	async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
		const t = target as { type: string };
		switch (t.type) {
			case "server": return this.checkServer(checks);
			case "upstream": return this.checkUpstream(target as { type: string; address: string }, checks);
			default: throw new Error(`Unknown target type: ${t.type}`);
		}
	}

	private async checkServer(checks: string[]): Promise<CheckResult[]> {
		let reloadSuccess: number;
		try {
			reloadSuccess = await this.client.getConfigReloadSuccess();
		} catch (err) {
			if (err instanceof CaddyApiError) {
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
				case "config_reload_success": return { check, value: reloadSuccess };
				default: return {
					check,
					error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` },
				};
			}
		});
	}

	private async checkUpstream(target: { type: string; address: string }, checks: string[]): Promise<CheckResult[]> {
		let upstreams: Awaited<ReturnType<typeof this.client.getUpstreams>>;
		try {
			upstreams = await this.client.getUpstreams();
		} catch (err) {
			if (err instanceof CaddyApiError) {
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

		const upstream = upstreams.find((u) => u.address === target.address);
		if (!upstream) {
			return checks.map((check) => ({
				check,
				error: { level: "target" as const, code: "upstream_not_found", title: errorTitle("upstream_not_found"), message: `No upstream with address "${target.address}" found` },
			}));
		}

		return checks.map((check) => {
			switch (check) {
				case "num_requests": return { check, value: upstream.num_requests };
				case "fails": return { check, value: upstream.fails };
				default: return {
					check,
					error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` },
				};
			}
		});
	}
}

// --- Export ---

function makeInstance(config: unknown): { url: string; timeoutMs: number } {
	const { url, timeout } = caddyConfig.parse(config);
	return { url, timeoutMs: timeout ? parseDuration(timeout) : 30_000 };
}

const caddyRemote = {
	name: caddyProvider.name,
	definition: caddyProvider,
	providerConfigSchema: providerConfigSchema(caddyProvider.config, caddyProvider.targetTypes, caddyProvider.name),
	targetConfigSchema: allTargetConfigsSchema(caddyProvider.targetTypes),
	createInstance: (config: unknown) => new CaddyProviderInstance(makeInstance(config)),
} satisfies Provider;

export const providers: Provider[] = [caddyRemote];
