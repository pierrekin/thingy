import { z } from "zod";
import {
	defineCheck,
	defineProvider,
	bindCheck,
	providerConfigSchema,
	allTargetConfigsSchema,
	type CheckResult,
} from "../../mantle/src/framework/index.ts";

// --- Checks ---

const exitCodeCheck = defineCheck({
	name: "exit_code",
	measurement: z.object({ exit_code: z.number() }),
	operators: ["equals", "not"] as const,
	defaults: { equals: 0 },
});

const outputCheck = defineCheck({
	name: "output",
	measurement: z.object({ value: z.number() }),
	operators: ["max", "min", "equals", "not"] as const,
	defaults: {},
});

// --- Provider definition ---

const shellProviderConfig = z.object({
	env: z.record(z.string()).optional(),
});

export const shellProvider = defineProvider({
	name: "shell",
	config: shellProviderConfig,
	defaultInterval: "1m",
	targetTypes: {
		command: {
			schema: z.object({
				command: z.string(),
				timeout: z.number().optional(),
				shell: z.string().optional(),
				env: z.record(z.string()).optional(),
			}),
			checks: {
				exit_code: bindCheck(exitCodeCheck),
				output: bindCheck(outputCheck, { enabled: false }),
			},
			defaultInterval: "1m",
		},
	},
});

// --- Schemas ---

export const shellProviderConfigSchema = providerConfigSchema(
	shellProvider.config,
	shellProvider.targetTypes,
	shellProvider.name,
);

export const shellTargetConfigSchema = allTargetConfigsSchema(
	shellProvider.targetTypes,
);

// --- Types ---

export type ShellProviderConfig = {
	env?: Record<string, string>;
	type?: string;
	interval?: string;
	intervals?: Record<string, string>;
	checks?: Record<string, unknown>;
};

export type ShellTargetConfig = z.infer<typeof shellTargetConfigSchema>;

// --- Error titles ---

const ERROR_TITLES: Record<string, string> = {
	spawn_error: "Failed to execute command",
	timeout: "Command timed out",
	parse_error: "Cannot parse command output as number",
};

// --- Provider instance ---

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_SHELL = "/bin/sh";

export class ShellProviderInstance {
	constructor(public config: ShellProviderConfig) {}

	getErrorTitle(code: string): string {
		return ERROR_TITLES[code] ?? code;
	}

	async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
		const t = target as {
			type: string;
			name: string;
			command: string;
			timeout?: number;
			shell?: string;
			env?: Record<string, string>;
		};

		const shell = t.shell ?? DEFAULT_SHELL;
		const timeout = t.timeout ?? DEFAULT_TIMEOUT;
		const env = { ...process.env, ...this.config.env, ...t.env };

		// Run the command once, share result across all checks
		let exitCode: number;
		let stdout: string;
		let spawnError: Error | null = null;
		let timedOut = false;

		try {
			const proc = Bun.spawn([shell, "-c", t.command], {
				env,
				stdout: "pipe",
				stderr: "pipe",
			});

			const timeoutPromise = new Promise<"timeout">((resolve) =>
				setTimeout(() => resolve("timeout"), timeout),
			);

			const result = await Promise.race([
				proc.exited.then((code) => ({ kind: "done" as const, code })),
				timeoutPromise.then(() => ({ kind: "timeout" as const, code: -1 })),
			]);

			if (result.kind === "timeout") {
				proc.kill();
				timedOut = true;
				exitCode = -1;
				stdout = "";
			} else {
				exitCode = result.code;
				stdout = await new Response(proc.stdout).text();
			}
		} catch (err) {
			spawnError = err instanceof Error ? err : new Error(String(err));
			exitCode = -1;
			stdout = "";
		}

		// Produce a result for each requested check
		const results: CheckResult[] = [];

		for (const checkName of checks) {
			if (spawnError) {
				results.push({
					check: checkName,
					error: {
						level: "target",
						code: "spawn_error",
						title: this.getErrorTitle("spawn_error"),
						message: spawnError.message,
					},
				});
				continue;
			}

			if (timedOut) {
				results.push({
					check: checkName,
					error: {
						level: "check",
						code: "timeout",
						title: this.getErrorTitle("timeout"),
						message: `Command did not complete within ${timeout}ms`,
					},
				});
				continue;
			}

			switch (checkName) {
				case "exit_code":
					results.push({ check: checkName, value: exitCode });
					break;

				case "output": {
					const parsed = Number(stdout.trim());
					if (Number.isNaN(parsed)) {
						results.push({
							check: checkName,
							error: {
								level: "check",
								code: "parse_error",
								title: this.getErrorTitle("parse_error"),
								message: `stdout was: ${stdout.slice(0, 200).trim() || "(empty)"}`,
							},
						});
					} else {
						results.push({ check: checkName, value: parsed });
					}
					break;
				}

				default:
					results.push({
						check: checkName,
						error: {
							level: "check",
							code: "unknown_check",
							title: `Unknown check: ${checkName}`,
							message: `The check "${checkName}" is not supported by the shell provider`,
						},
					});
			}
		}

		return results;
	}
}

// --- Default export ---

export default {
	name: "shell",
	definition: shellProvider,
	providerConfigSchema: shellProviderConfigSchema,
	targetConfigSchema: shellTargetConfigSchema,
	createInstance: (config: unknown) =>
		new ShellProviderInstance(config as ShellProviderConfig),
};
