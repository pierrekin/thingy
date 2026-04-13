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
import {
  ResticClient,
  ResticBinaryError,
  ResticRepoError,
  ResticError,
} from "./restic.ts";

const freshnessCheck = defineCheck({
  name: "freshness",
  measurement: z.object({ age_seconds: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 86400, over: "5m" },
});

const resticProviderConfig = z.object({
  env: z.record(z.string()).optional(),
});

export const resticProvider = defineProvider({
  name: "@mantle/restic/repo",
  config: resticProviderConfig,
  defaultInterval: "5m",
  targetTypes: {
    repo: {
      schema: z.object({
        repository: z.string(),
        password: z.string().optional(),
        passwordFile: z.string().optional(),
        env: z.record(z.string()).optional(),
        host: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      checks: {
        freshness: bindCheck(freshnessCheck),
      },
      defaultInterval: "5m",
    },
  },
});

export const resticProviderConfigSchema = providerConfigSchema(
  resticProvider.config,
  resticProvider.targetTypes,
  resticProvider.name,
);

export const resticTargetConfigSchema = allTargetConfigsSchema(
  resticProvider.targetTypes,
);

export type ResticProviderConfig = {
  env?: Record<string, string>;
  type?: string;
  interval?: string;
  intervals?: Record<string, string>;
  checks?: Record<string, unknown>;
};

export type ResticTargetConfig = z.infer<typeof resticTargetConfigSchema>;

const ERROR_TITLES: Record<string, string> = {
  binary_error: "Restic binary not available",
  repo_access: "Cannot access repository",
  repo_unreachable: "Repository unreachable",
  command_failed: "Restic command failed",
  parse_error: "Unexpected restic output",
};

export class ResticProviderInstance {
  constructor(public config: ResticProviderConfig) {}

  getErrorTitle(code: string): string {
    return ERROR_TITLES[code] ?? code;
  }

  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as {
      type: string;
      name: string;
      repository: string;
      password?: string;
      passwordFile?: string;
      env?: Record<string, string>;
      host?: string;
      tags?: string[];
    };

    // Merge provider-level env with target-level env (target wins)
    const client = new ResticClient({
      repository: t.repository,
      password: t.password,
      passwordFile: t.passwordFile,
      env: { ...this.config.env, ...t.env },
    });

    const results: CheckResult[] = [];

    for (const checkName of checks) {
      try {
        const value = await this.runCheck(client, t, checkName);
        results.push({ check: checkName, value });
      } catch (err) {
        if (err instanceof ResticBinaryError) {
          results.push({
            check: checkName,
            error: {
              level: "provider",
              code: err.code,
              title: this.getErrorTitle(err.code),
              message: err.message,
            },
          });
        } else if (err instanceof ResticRepoError) {
          results.push({
            check: checkName,
            error: {
              level: "target",
              code: err.code,
              title: this.getErrorTitle(err.code),
              message: err.message,
            },
          });
        } else {
          const code = err instanceof ResticError ? err.code : "unknown";
          results.push({
            check: checkName,
            error: {
              level: "check",
              code,
              title: this.getErrorTitle(code),
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }

    return results;
  }

  private async runCheck(
    client: ResticClient,
    target: { host?: string; tags?: string[] },
    checkName: string,
  ): Promise<number> {
    switch (checkName) {
      case "freshness":
        return this.checkFreshness(client, target);
      default:
        throw new Error(`Unknown check: ${checkName}`);
    }
  }

  private async checkFreshness(
    client: ResticClient,
    target: { host?: string; tags?: string[] },
  ): Promise<number> {
    const snapshot = await client.getLatestSnapshot({
      host: target.host,
      tags: target.tags,
    });

    if (!snapshot) {
      // No snapshots — return a very large age so it trips any max threshold
      return Number.MAX_SAFE_INTEGER;
    }

    const snapshotTime = new Date(snapshot.time).getTime();
    const ageSeconds = (Date.now() - snapshotTime) / 1000;
    return ageSeconds;
  }
}

export const resticRepo = {
  name: resticProvider.name,
  definition: resticProvider,
  providerConfigSchema: resticProviderConfigSchema,
  targetConfigSchema: resticTargetConfigSchema,
  createInstance: (config: unknown) =>
    new ResticProviderInstance(config as ResticProviderConfig),
} satisfies Provider;

export const providers: Provider[] = [resticRepo];
