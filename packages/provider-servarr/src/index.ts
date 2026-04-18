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
import { ServarrApiError, ServarrClientV1, ServarrClientV3 } from "./client.ts";

// --- Shared config ---

const servarrConfig = z.object({
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

// --- Shared checks ---

const healthErrorsCheck = defineCheck({
  name: "errors",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

const healthWarningsCheck = defineCheck({
  name: "warnings",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

const queueSizeCheck = defineCheck({
  name: "size",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 100 },
});

const queueErrorsCheck = defineCheck({
  name: "errors",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

const monitoredCheck = defineCheck({
  name: "monitored",
  measurement: z.object({ monitored: z.boolean() }),
  operators: ["equals"] as const,
  defaults: { equals: true },
  enumValues: { true: 1, false: 0 },
});

// --- Per-app checks ---

const missingEpisodesCheck = defineCheck({
  name: "missing_episodes",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

const downloadedCheck = defineCheck({
  name: "downloaded",
  measurement: z.object({ downloaded: z.boolean() }),
  operators: ["equals"] as const,
  defaults: { equals: true },
  enumValues: { true: 1, false: 0 },
});

const missingTracksCheck = defineCheck({
  name: "missing_tracks",
  measurement: z.object({ count: z.number() }),
  operators: ["max"] as const,
  defaults: { max: 0 },
});

const indexerEnabledCheck = defineCheck({
  name: "enabled",
  measurement: z.object({ enabled: z.boolean() }),
  operators: ["equals"] as const,
  defaults: { equals: true },
  enumValues: { true: 1, false: 0 },
});

// --- Shared check helpers ---

function providerError(checks: string[], err: ServarrApiError): CheckResult[] {
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

function targetError(checks: string[], err: ServarrApiError): CheckResult[] {
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

async function checkHealth(
  client: ServarrClientV1 | ServarrClientV3,
  checks: string[],
): Promise<CheckResult[]> {
  let health: Awaited<ReturnType<typeof client.getHealth>>;
  try {
    health = await client.getHealth();
  } catch (err) {
    if (err instanceof ServarrApiError) return providerError(checks, err);
    return unknownError(checks, err);
  }
  const errors = health.filter((h) => h.type === "error").length;
  const warnings = health.filter((h) => h.type === "warning").length;
  return checks.map((check) => {
    switch (check) {
      case "errors":
        return { check, value: errors };
      case "warnings":
        return { check, value: warnings };
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

async function checkQueue(
  client: ServarrClientV1 | ServarrClientV3,
  checks: string[],
): Promise<CheckResult[]> {
  let queue: Awaited<ReturnType<typeof client.getQueue>>;
  try {
    queue = await client.getQueue();
  } catch (err) {
    if (err instanceof ServarrApiError) return providerError(checks, err);
    return unknownError(checks, err);
  }
  const size = queue.totalRecords;
  const errors = queue.records.filter(
    (r) => r.status === "failed" || r.errorMessage !== undefined,
  ).length;
  return checks.map((check) => {
    switch (check) {
      case "size":
        return { check, value: size };
      case "errors":
        return { check, value: errors };
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

// --- Sonarr ---

const sonarrProvider = defineProvider({
  name: "@mantle/sonarr/remote",
  config: servarrConfig,
  defaultInterval: "1m",
  targetTypes: {
    series: {
      schema: z.object({ seriesId: z.number() }),
      checks: {
        monitored: bindCheck(monitoredCheck),
        missing_episodes: bindCheck(missingEpisodesCheck),
      },
      defaultInterval: "5m",
    },
    queue: {
      schema: z.object({}),
      checks: {
        size: bindCheck(queueSizeCheck),
        errors: bindCheck(queueErrorsCheck),
      },
      defaultInterval: "1m",
    },
    health: {
      schema: z.object({}),
      checks: {
        errors: bindCheck(healthErrorsCheck),
        warnings: bindCheck(healthWarningsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

type SonarrTarget =
  | { type: "series"; seriesId: number }
  | { type: "queue" }
  | { type: "health" };

class SonarrProviderInstance {
  private client: ServarrClientV3;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new ServarrClientV3(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }
  getErrorTitle(code: string): string {
    return errorTitle(code);
  }
  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as SonarrTarget;
    switch (t.type) {
      case "series":
        return this.checkSeries(t.seriesId, checks);
      case "queue":
        return checkQueue(this.client, checks);
      case "health":
        return checkHealth(this.client, checks);
    }
  }
  private async checkSeries(
    id: number,
    checks: string[],
  ): Promise<CheckResult[]> {
    let series: Awaited<ReturnType<typeof this.client.getSeries>>;
    try {
      series = await this.client.getSeries(id);
    } catch (err) {
      if (err instanceof ServarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    const missing =
      series.statistics.totalEpisodeCount - series.statistics.episodeFileCount;
    return checks.map((check) => {
      switch (check) {
        case "monitored":
          return { check, value: series.monitored ? 1 : 0 };
        case "missing_episodes":
          return { check, value: Math.max(0, missing) };
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

// --- Radarr ---

const radarrProvider = defineProvider({
  name: "@mantle/radarr/remote",
  config: servarrConfig,
  defaultInterval: "5m",
  targetTypes: {
    movie: {
      schema: z.object({ movieId: z.number() }),
      checks: {
        monitored: bindCheck(monitoredCheck),
        downloaded: bindCheck(downloadedCheck),
      },
      defaultInterval: "5m",
    },
    queue: {
      schema: z.object({}),
      checks: {
        size: bindCheck(queueSizeCheck),
        errors: bindCheck(queueErrorsCheck),
      },
      defaultInterval: "1m",
    },
    health: {
      schema: z.object({}),
      checks: {
        errors: bindCheck(healthErrorsCheck),
        warnings: bindCheck(healthWarningsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

type RadarrTarget =
  | { type: "movie"; movieId: number }
  | { type: "queue" }
  | { type: "health" };

class RadarrProviderInstance {
  private client: ServarrClientV3;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new ServarrClientV3(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }
  getErrorTitle(code: string): string {
    return errorTitle(code);
  }
  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as RadarrTarget;
    switch (t.type) {
      case "movie":
        return this.checkMovie(t.movieId, checks);
      case "queue":
        return checkQueue(this.client, checks);
      case "health":
        return checkHealth(this.client, checks);
    }
  }
  private async checkMovie(
    id: number,
    checks: string[],
  ): Promise<CheckResult[]> {
    let movie: Awaited<ReturnType<typeof this.client.getMovie>>;
    try {
      movie = await this.client.getMovie(id);
    } catch (err) {
      if (err instanceof ServarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    return checks.map((check) => {
      switch (check) {
        case "monitored":
          return { check, value: movie.monitored ? 1 : 0 };
        case "downloaded":
          return { check, value: movie.hasFile ? 1 : 0 };
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

// --- Lidarr ---

const lidarrProvider = defineProvider({
  name: "@mantle/lidarr/remote",
  config: servarrConfig,
  defaultInterval: "5m",
  targetTypes: {
    artist: {
      schema: z.object({ artistId: z.number() }),
      checks: {
        monitored: bindCheck(monitoredCheck),
        missing_tracks: bindCheck(missingTracksCheck),
      },
      defaultInterval: "5m",
    },
    queue: {
      schema: z.object({}),
      checks: {
        size: bindCheck(queueSizeCheck),
        errors: bindCheck(queueErrorsCheck),
      },
      defaultInterval: "1m",
    },
    health: {
      schema: z.object({}),
      checks: {
        errors: bindCheck(healthErrorsCheck),
        warnings: bindCheck(healthWarningsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

type LidarrTarget =
  | { type: "artist"; artistId: number }
  | { type: "queue" }
  | { type: "health" };

class LidarrProviderInstance {
  private client: ServarrClientV1;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new ServarrClientV1(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }
  getErrorTitle(code: string): string {
    return errorTitle(code);
  }
  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as LidarrTarget;
    switch (t.type) {
      case "artist":
        return this.checkArtist(t.artistId, checks);
      case "queue":
        return checkQueue(this.client, checks);
      case "health":
        return checkHealth(this.client, checks);
    }
  }
  private async checkArtist(
    id: number,
    checks: string[],
  ): Promise<CheckResult[]> {
    let artist: Awaited<ReturnType<typeof this.client.getArtist>>;
    try {
      artist = await this.client.getArtist(id);
    } catch (err) {
      if (err instanceof ServarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    const missing =
      artist.statistics.totalTrackCount - artist.statistics.trackFileCount;
    return checks.map((check) => {
      switch (check) {
        case "monitored":
          return { check, value: artist.monitored ? 1 : 0 };
        case "missing_tracks":
          return { check, value: Math.max(0, missing) };
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

// --- Prowlarr ---

const prowlarrProvider = defineProvider({
  name: "@mantle/prowlarr/remote",
  config: servarrConfig,
  defaultInterval: "5m",
  targetTypes: {
    indexer: {
      schema: z.object({ indexerId: z.number() }),
      checks: {
        enabled: bindCheck(indexerEnabledCheck),
      },
      defaultInterval: "5m",
    },
    health: {
      schema: z.object({}),
      checks: {
        errors: bindCheck(healthErrorsCheck),
        warnings: bindCheck(healthWarningsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

type ProwlarrTarget =
  | { type: "indexer"; indexerId: number }
  | { type: "health" };

class ProwlarrProviderInstance {
  private client: ServarrClientV1;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new ServarrClientV1(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }
  getErrorTitle(code: string): string {
    return errorTitle(code);
  }
  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as ProwlarrTarget;
    switch (t.type) {
      case "indexer":
        return this.checkIndexer(t.indexerId, checks);
      case "health":
        return checkHealth(this.client, checks);
    }
  }
  private async checkIndexer(
    id: number,
    checks: string[],
  ): Promise<CheckResult[]> {
    let indexer: Awaited<ReturnType<typeof this.client.getIndexer>>;
    try {
      indexer = await this.client.getIndexer(id);
    } catch (err) {
      if (err instanceof ServarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    return checks.map((check) => {
      switch (check) {
        case "enabled":
          return { check, value: indexer.enableRss ? 1 : 0 };
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

// --- Whisparr v2 ---

const whisparrV2Provider = defineProvider({
  name: "@mantle/whisparr-v2/remote",
  config: servarrConfig,
  defaultInterval: "5m",
  targetTypes: {
    series: {
      schema: z.object({ seriesId: z.number() }),
      checks: {
        monitored: bindCheck(monitoredCheck),
        missing_episodes: bindCheck(missingEpisodesCheck),
      },
      defaultInterval: "5m",
    },
    queue: {
      schema: z.object({}),
      checks: {
        size: bindCheck(queueSizeCheck),
        errors: bindCheck(queueErrorsCheck),
      },
      defaultInterval: "1m",
    },
    health: {
      schema: z.object({}),
      checks: {
        errors: bindCheck(healthErrorsCheck),
        warnings: bindCheck(healthWarningsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

type WhisparrV2Target =
  | { type: "series"; seriesId: number }
  | { type: "queue" }
  | { type: "health" };

class WhisparrV2ProviderInstance {
  private client: ServarrClientV3;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new ServarrClientV3(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }
  getErrorTitle(code: string): string {
    return errorTitle(code);
  }
  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as WhisparrV2Target;
    switch (t.type) {
      case "series":
        return this.checkSeries(t.seriesId, checks);
      case "queue":
        return checkQueue(this.client, checks);
      case "health":
        return checkHealth(this.client, checks);
    }
  }
  private async checkSeries(
    id: number,
    checks: string[],
  ): Promise<CheckResult[]> {
    let series: Awaited<ReturnType<typeof this.client.getSeries>>;
    try {
      series = await this.client.getSeries(id);
    } catch (err) {
      if (err instanceof ServarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    const missing =
      series.statistics.totalEpisodeCount - series.statistics.episodeFileCount;
    return checks.map((check) => {
      switch (check) {
        case "monitored":
          return { check, value: series.monitored ? 1 : 0 };
        case "missing_episodes":
          return { check, value: Math.max(0, missing) };
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

// --- Whisparr ---

const whisparrProvider = defineProvider({
  name: "@mantle/whisparr/remote",
  config: servarrConfig,
  defaultInterval: "5m",
  targetTypes: {
    scene: {
      schema: z.object({ sceneId: z.number() }),
      checks: {
        monitored: bindCheck(monitoredCheck),
        downloaded: bindCheck(downloadedCheck),
      },
      defaultInterval: "5m",
    },
    queue: {
      schema: z.object({}),
      checks: {
        size: bindCheck(queueSizeCheck),
        errors: bindCheck(queueErrorsCheck),
      },
      defaultInterval: "1m",
    },
    health: {
      schema: z.object({}),
      checks: {
        errors: bindCheck(healthErrorsCheck),
        warnings: bindCheck(healthWarningsCheck),
      },
      defaultInterval: "5m",
    },
  },
});

type WhisparrTarget =
  | { type: "scene"; sceneId: number }
  | { type: "queue" }
  | { type: "health" };

class WhisparrProviderInstance {
  private client: ServarrClientV3;
  constructor(config: { url: string; api_key: string; timeoutMs: number }) {
    this.client = new ServarrClientV3(
      config.url,
      config.api_key,
      config.timeoutMs,
    );
  }
  getErrorTitle(code: string): string {
    return errorTitle(code);
  }
  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as WhisparrTarget;
    switch (t.type) {
      case "scene":
        return this.checkScene(t.sceneId, checks);
      case "queue":
        return checkQueue(this.client, checks);
      case "health":
        return checkHealth(this.client, checks);
    }
  }
  private async checkScene(
    id: number,
    checks: string[],
  ): Promise<CheckResult[]> {
    let scene: Awaited<ReturnType<typeof this.client.getScene>>;
    try {
      scene = await this.client.getScene(id);
    } catch (err) {
      if (err instanceof ServarrApiError) {
        return err.code === "not_found"
          ? targetError(checks, err)
          : providerError(checks, err);
      }
      return unknownError(checks, err);
    }
    return checks.map((check) => {
      switch (check) {
        case "monitored":
          return { check, value: scene.monitored ? 1 : 0 };
        case "downloaded":
          return { check, value: scene.hasFile ? 1 : 0 };
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

// --- Provider exports ---

function makeInstance(config: unknown): {
  url: string;
  api_key: string;
  timeoutMs: number;
} {
  const { url, api_key, timeout } = servarrConfig.parse(config);
  return { url, api_key, timeoutMs: timeout ?? 30_000 };
}

const sonarrRemote = {
  name: sonarrProvider.name,
  definition: sonarrProvider,
  providerConfigSchema: providerConfigSchema(
    sonarrProvider.config,
    sonarrProvider.targetTypes,
    sonarrProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(sonarrProvider.targetTypes),
  createInstance: (config: unknown) =>
    new SonarrProviderInstance(makeInstance(config)),
} satisfies Provider;

const radarrRemote = {
  name: radarrProvider.name,
  definition: radarrProvider,
  providerConfigSchema: providerConfigSchema(
    radarrProvider.config,
    radarrProvider.targetTypes,
    radarrProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(radarrProvider.targetTypes),
  createInstance: (config: unknown) =>
    new RadarrProviderInstance(makeInstance(config)),
} satisfies Provider;

const lidarrRemote = {
  name: lidarrProvider.name,
  definition: lidarrProvider,
  providerConfigSchema: providerConfigSchema(
    lidarrProvider.config,
    lidarrProvider.targetTypes,
    lidarrProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(lidarrProvider.targetTypes),
  createInstance: (config: unknown) =>
    new LidarrProviderInstance(makeInstance(config)),
} satisfies Provider;

const prowlarrRemote = {
  name: prowlarrProvider.name,
  definition: prowlarrProvider,
  providerConfigSchema: providerConfigSchema(
    prowlarrProvider.config,
    prowlarrProvider.targetTypes,
    prowlarrProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(prowlarrProvider.targetTypes),
  createInstance: (config: unknown) =>
    new ProwlarrProviderInstance(makeInstance(config)),
} satisfies Provider;

const whisparrV2Remote = {
  name: whisparrV2Provider.name,
  definition: whisparrV2Provider,
  providerConfigSchema: providerConfigSchema(
    whisparrV2Provider.config,
    whisparrV2Provider.targetTypes,
    whisparrV2Provider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(whisparrV2Provider.targetTypes),
  createInstance: (config: unknown) =>
    new WhisparrV2ProviderInstance(makeInstance(config)),
} satisfies Provider;

const whisparrRemote = {
  name: whisparrProvider.name,
  definition: whisparrProvider,
  providerConfigSchema: providerConfigSchema(
    whisparrProvider.config,
    whisparrProvider.targetTypes,
    whisparrProvider.name,
  ),
  targetConfigSchema: allTargetConfigsSchema(whisparrProvider.targetTypes),
  createInstance: (config: unknown) =>
    new WhisparrProviderInstance(makeInstance(config)),
} satisfies Provider;

export const providers: Provider[] = [
  sonarrRemote,
  radarrRemote,
  lidarrRemote,
  prowlarrRemote,
  whisparrV2Remote,
  whisparrRemote,
];
