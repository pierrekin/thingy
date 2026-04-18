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
import { TautulliApiError, TautulliClient } from "./client.ts";

// --- Config ---

const tautulliConfig = z.object({
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

const streamsCheck = defineCheck({
  name: "streams",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

const playsCheck = defineCheck({
  name: "plays",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

// --- Provider definition ---

const tautulliProvider = defineProvider({
  name: "@mantle/tautulli/remote",
  config: tautulliConfig,
  defaultInterval: "1m",
  targetTypes: {
    activity: {
      schema: z.object({}),
      checks: {
        streams: bindCheck(streamsCheck),
      },
      defaultInterval: "1m",
    },
    history: {
      schema: z.object({}),
      checks: {
        plays: bindCheck(playsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

// --- Provider instance ---

class TautulliProviderInstance {
  private client: TautulliClient;

  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new TautulliClient(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }

  getErrorTitle(code: string): string {
    return errorTitle(code);
  }

  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as { type: string };
    switch (t.type) {
      case "activity":
        return this.checkActivity(checks);
      case "history":
        return this.checkHistory(checks);
      default:
        throw new Error(`Unknown target type: ${t.type}`);
    }
  }

  private async checkActivity(checks: string[]): Promise<CheckResult[]> {
    let data: Awaited<ReturnType<typeof this.client.getActivity>>;
    try {
      data = await this.client.getActivity();
    } catch (err) {
      if (err instanceof TautulliApiError) {
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
    return checks.map((check) => {
      switch (check) {
        case "streams":
          return { check, value: data.sessions.length };
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

  private async checkHistory(checks: string[]): Promise<CheckResult[]> {
    let data: Awaited<ReturnType<typeof this.client.getHistory>>;
    try {
      data = await this.client.getHistory();
    } catch (err) {
      if (err instanceof TautulliApiError) {
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
    return checks.map((check) => {
      switch (check) {
        case "plays":
          return { check, value: data.recordsTotal };
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
  const { url, api_key, timeout } = tautulliConfig.parse(config);
  return { url, api_key, timeoutMs: timeout ?? 30_000 };
}

const tautulliRemote = {
  name: tautulliProvider.name,
  definition: tautulliProvider,
  providerConfigSchema: providerConfigSchema(
    tautulliProvider.config,
    tautulliProvider.targetTypes,
    tautulliProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(tautulliProvider.targetTypes),
  createInstance: (config: unknown) =>
    new TautulliProviderInstance(makeInstance(config)),
} satisfies Provider;

export const providers: Provider[] = [tautulliRemote];
