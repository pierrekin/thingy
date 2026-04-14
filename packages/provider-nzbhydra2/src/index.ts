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
import { NzbHydra2Client, NzbHydra2ApiError } from "./client.ts";

// --- Config ---

const nzbhydra2Config = z.object({
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

const totalSearchesCheck = defineCheck({
	name: "total_searches",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

const totalDownloadsCheck = defineCheck({
	name: "total_downloads",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

const enabledIndexersCheck = defineCheck({
	name: "enabled_indexers",
	measurement: z.object({ count: z.number() }),
	operators: ["min"] as const,
	defaults: { min: 1 },
});

const disabledIndexersCheck = defineCheck({
	name: "disabled_indexers",
	measurement: z.object({ count: z.number() }),
	operators: ["max"] as const,
	defaults: { max: 0 },
});

// --- Provider definition ---

const nzbhydra2Provider = defineProvider({
	name: "@mantle/nzbhydra2/remote",
	config: nzbhydra2Config,
	defaultInterval: "5m",
	targetTypes: {
		instance: {
			schema: z.object({}),
			checks: {
				total_searches: bindCheck(totalSearchesCheck),
				total_downloads: bindCheck(totalDownloadsCheck),
				enabled_indexers: bindCheck(enabledIndexersCheck),
				disabled_indexers: bindCheck(disabledIndexersCheck),
			},
			defaultInterval: "5m",
		},
	},
});

// --- Provider instance ---

function parseDuration(s: string): number {
	const match = s.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i);
	if (!match) throw new Error(`Invalid timeout value: "${s}"`);
	const value = parseFloat(match[1]!);
	const unit = match[2]!.toLowerCase();
	const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return Math.floor(value * multipliers[unit]!);
}

class NzbHydra2ProviderInstance {
	private client: NzbHydra2Client;

	constructor(config: { url: string; api_key: string; timeoutMs: number }) {
		this.client = new NzbHydra2Client(config.url, config.api_key, config.timeoutMs);
	}

	getErrorTitle(code: string): string {
		return errorTitle(code);
	}

	async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
		const t = target as { type: string };
		switch (t.type) {
			case "instance": return this.checkInstance(checks);
			default: throw new Error(`Unknown target type: ${t.type}`);
		}
	}

	private async checkInstance(checks: string[]): Promise<CheckResult[]> {
		const results: CheckResult[] = [];

		const needsIndexers = checks.includes("enabled_indexers") || checks.includes("disabled_indexers");
		const needsSearches = checks.includes("total_searches");
		const needsDownloads = checks.includes("total_downloads");

		let indexerStatuses: Awaited<ReturnType<typeof this.client.getIndexerStatuses>> | NzbHydra2ApiError | null = null;
		let searchCount: number | NzbHydra2ApiError | null = null;
		let downloadCount: number | NzbHydra2ApiError | null = null;

		const fetches: Promise<void>[] = [];

		if (needsIndexers) {
			fetches.push(
				this.client.getIndexerStatuses()
					.then((d) => { indexerStatuses = d; })
					.catch((err) => { indexerStatuses = err instanceof NzbHydra2ApiError ? err : new NzbHydra2ApiError("unknown", err instanceof Error ? err.message : String(err)); }),
			);
		}
		if (needsSearches) {
			fetches.push(
				this.client.getSearchCount()
					.then((n) => { searchCount = n; })
					.catch((err) => { searchCount = err instanceof NzbHydra2ApiError ? err : new NzbHydra2ApiError("unknown", err instanceof Error ? err.message : String(err)); }),
			);
		}
		if (needsDownloads) {
			fetches.push(
				this.client.getDownloadCount()
					.then((n) => { downloadCount = n; })
					.catch((err) => { downloadCount = err instanceof NzbHydra2ApiError ? err : new NzbHydra2ApiError("unknown", err instanceof Error ? err.message : String(err)); }),
			);
		}

		await Promise.all(fetches);

		for (const check of checks) {
			switch (check) {
				case "enabled_indexers": {
					if (indexerStatuses instanceof NzbHydra2ApiError) {
						results.push({ check, error: { level: "provider" as const, code: indexerStatuses.code, title: errorTitle(indexerStatuses.code), message: indexerStatuses.message } });
					} else {
						const count = (indexerStatuses as NonNullable<typeof indexerStatuses>)!.filter((s) => s.state === "ENABLED").length;
						results.push({ check, value: count });
					}
					break;
				}
				case "disabled_indexers": {
					if (indexerStatuses instanceof NzbHydra2ApiError) {
						results.push({ check, error: { level: "provider" as const, code: indexerStatuses.code, title: errorTitle(indexerStatuses.code), message: indexerStatuses.message } });
					} else {
						const count = (indexerStatuses as NonNullable<typeof indexerStatuses>)!.filter((s) => s.state !== "ENABLED").length;
						results.push({ check, value: count });
					}
					break;
				}
				case "total_searches": {
					if (searchCount instanceof NzbHydra2ApiError) {
						results.push({ check, error: { level: "provider" as const, code: searchCount.code, title: errorTitle(searchCount.code), message: searchCount.message } });
					} else {
						results.push({ check, value: searchCount as number });
					}
					break;
				}
				case "total_downloads": {
					if (downloadCount instanceof NzbHydra2ApiError) {
						results.push({ check, error: { level: "provider" as const, code: downloadCount.code, title: errorTitle(downloadCount.code), message: downloadCount.message } });
					} else {
						results.push({ check, value: downloadCount as number });
					}
					break;
				}
				default:
					results.push({ check, error: { level: "check" as const, code: "unknown_check", title: `Unknown check: ${check}`, message: `The check "${check}" is not supported on this target type` } });
			}
		}

		return results;
	}
}

// --- Export ---

const nzbhydra2Remote = {
	name: nzbhydra2Provider.name,
	definition: nzbhydra2Provider,
	providerConfigSchema: providerConfigSchema(nzbhydra2Provider.config, nzbhydra2Provider.targetTypes, nzbhydra2Provider.name),
	targetConfigSchema: allTargetConfigsSchema(nzbhydra2Provider.targetTypes),
	createInstance: (config: unknown) => {
		const { url, api_key, timeout } = nzbhydra2Config.parse(config);
		return new NzbHydra2ProviderInstance({ url, api_key, timeoutMs: timeout ? parseDuration(timeout) : 30_000 });
	},
} satisfies Provider;

export const providers: Provider[] = [nzbhydra2Remote];
