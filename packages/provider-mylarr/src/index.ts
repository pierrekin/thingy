import {
  allTargetConfigsSchema,
  bindCheck,
  type CheckResult,
  defineCheck,
  defineProvider,
  duration,
  type Provider,
  providerConfigSchema,
} from "mantle-framework";
import { z } from "zod";
import { MylarrApiError, MylarrClient } from "./client.ts";

// --- Config ---

const mylarrConfig = z.object({
  url: z.string(),
  api_key: z.string(),
  timeout: duration.optional(),
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

const monitoredCheck = defineCheck({
  name: "monitored",
  measurement: z.object({ monitored: z.boolean() }),
  operators: ["equals"] as const,
  defaults: { equals: true },
  enumValues: { true: 1, false: 0 },
});

const missingIssuesCheck = defineCheck({
  name: "missing_issues",
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

function providerError(checks: string[], err: MylarrApiError): CheckResult[] {
  return checks.map((check) => ({
    check,
    error: {
      level: "provider" as const,
      code: err.code,
      title: errorTitle(err.code),
      message: err.message,
    },
  }));
}

function targetError(checks: string[], err: MylarrApiError): CheckResult[] {
  return checks.map((check) => ({
    check,
    error: {
      level: "target" as const,
      code: err.code,
      title: errorTitle(err.code),
      message: err.message,
    },
  }));
}

function unknownError(checks: string[], err: unknown): CheckResult[] {
  const message = err instanceof Error ? err.message : String(err);
  return checks.map((check) => ({
    check,
    error: {
      level: "check" as const,
      code: "unknown",
      title: "Unknown error",
      message,
    },
  }));
}

// --- Provider definition ---

const mylarrProvider = defineProvider({
  name: "@mantle/mylarr/remote",
  config: mylarrConfig,
  defaultInterval: "5m",
  targetTypes: {
    comic: {
      schema: z.object({ comicId: z.string() }),
      checks: {
        monitored: bindCheck(monitoredCheck),
        missing_issues: bindCheck(missingIssuesCheck),
      },
      defaultInterval: "5m",
    },
    wanted: {
      schema: z.object({}),
      checks: {
        count: bindCheck(wantedCountCheck),
      },
      defaultInterval: "5m",
    },
  },
});

// --- Provider instance ---

class MylarrProviderInstance {
  private client: MylarrClient;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new MylarrClient(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }

  getErrorTitle(code: string): string {
    return errorTitle(code);
  }

  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as { type: string; comicId?: string };
    switch (t.type) {
      case "comic":
        return this.checkComic(t.comicId!, checks);
      case "wanted":
        return this.checkWanted(checks);
      default:
        throw new Error(`Unknown target type: ${t.type}`);
    }
  }

  private async checkComic(
    id: string,
    checks: string[],
  ): Promise<CheckResult[]> {
    let result: Awaited<ReturnType<typeof this.client.getComic>>;
    try {
      result = await this.client.getComic(id);
    } catch (err) {
      if (err instanceof MylarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    if (result.comic.length === 0) {
      const notFound = new MylarrApiError(
        "not_found",
        `No comic found with id: ${id}`,
      );
      return targetError(checks, notFound);
    }
    const comic = result.comic[0]!;
    const downloaded = result.issues.filter(
      (i) => i.status === "Downloaded",
    ).length;
    const missing = Math.max(0, comic.totalIssues - downloaded);
    return checks.map((check) => {
      switch (check) {
        case "monitored":
          return { check, value: comic.status === "Active" ? 1 : 0 };
        case "missing_issues":
          return { check, value: missing };
        default:
          return {
            check,
            error: {
              level: "check" as const,
              code: "unknown_check",
              title: `Unknown check: ${check}`,
              message: `The check "${check}" is not supported on this target type`,
            },
          };
      }
    });
  }

  private async checkWanted(checks: string[]): Promise<CheckResult[]> {
    let result: Awaited<ReturnType<typeof this.client.getWanted>>;
    try {
      result = await this.client.getWanted();
    } catch (err) {
      if (err instanceof MylarrApiError) return providerError(checks, err);
      return unknownError(checks, err);
    }
    const count = result.issues.length;
    return checks.map((check) => {
      switch (check) {
        case "count":
          return { check, value: count };
        default:
          return {
            check,
            error: {
              level: "check" as const,
              code: "unknown_check",
              title: `Unknown check: ${check}`,
              message: `The check "${check}" is not supported on this target type`,
            },
          };
      }
    });
  }
}

// --- Export ---

function makeInstance(config: unknown): {
  url: string;
  api_key: string;
  timeoutMs: number;
} {
  const { url, api_key, timeout } = mylarrConfig.parse(config);
  return { url, api_key, timeoutMs: timeout ?? 30_000 };
}

const mylarrRemote = {
  name: mylarrProvider.name,
  definition: mylarrProvider,
  providerConfigSchema: providerConfigSchema(
    mylarrProvider.config,
    mylarrProvider.targetTypes,
    mylarrProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(mylarrProvider.targetTypes),
  createInstance: (config: unknown) =>
    new MylarrProviderInstance(makeInstance(config)),
} satisfies Provider;

export const providers: Provider[] = [mylarrRemote];
