import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { OperationalError } from "./errors.ts";

const listenSchema = z.string().transform((val, ctx) => {
  const match = val.match(/^(.+):(\d+)$/);
  if (!match) {
    ctx.addIssue({ code: "custom", message: "Must be ip:port" });
    return z.NEVER;
  }

  // Safe: regex guarantees two capture groups when match succeeds
  let ip = match[1]!;
  const port = parseInt(match[2]!, 10);

  // Handle IPv6 brackets
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  const ipResult = z.union([z.ipv4(), z.ipv6()]).safeParse(ip);
  if (!ipResult.success) {
    ctx.addIssue({ code: "custom", message: "Invalid IP address" });
    return z.NEVER;
  }

  if (port < 1 || port > 65535) {
    ctx.addIssue({ code: "custom", message: "Port must be 1-65535" });
    return z.NEVER;
  }

  return { ip, port };
});

const targetSchema = z
  .object({
    name: z.string(),
    provider: z.string(),
    type: z.string().optional(),
    interval: z.string().optional(),
    checks: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const placementRefSchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

const rawAgentSchema = z.object({
  name: z.string(),
  interval: z.string().optional(),
  targets: z.array(targetSchema),
  channels: z.array(placementRefSchema).optional(),
  sinks: z.array(placementRefSchema).optional(),
});

const rawHubSchema = z.object({
  name: z.string(),
  listen: listenSchema,
  channels: z.array(placementRefSchema).optional(),
  sinks: z.array(placementRefSchema).optional(),
});

const rawConfigSchema = z
  .object({
    hub: rawHubSchema.optional(),
    providers: z.record(z.string(), z.unknown()).optional(),
    channels: z.record(z.string(), z.unknown()).optional(),
    sinks: z.record(z.string(), z.unknown()).optional(),
    agent: rawAgentSchema.optional(),
    agents: z.record(z.string(), rawAgentSchema).optional(),
  })
  .refine((data) => !(data.agent && data.agents), {
    message: "Cannot specify both 'agent' and 'agents'",
  });

export type TargetConfig = {
  name: string;
  provider: string;
  type?: string;
  interval?: string;
  checks?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AgentConfig = {
  name: string;
  interval?: string;
  targets: TargetConfig[];
  channels: Record<string, unknown>;
  sinks: Record<string, unknown>;
};

export type HubConfig = {
  name: string;
  listen: { ip: string; port: number };
  channels: Record<string, unknown>;
  sinks: Record<string, unknown>;
};

export type Config = {
  hub?: HubConfig;
  providers: Record<string, unknown>;
  agents: Record<string, AgentConfig>;
};

type PlacementRef = string | Record<string, unknown>;

function resolvePlacements(
  placements: PlacementRef[] | undefined,
  definitions: Record<string, unknown> | undefined,
  kind: "channel" | "sink",
): Record<string, unknown> {
  if (!placements) return {};
  const result: Record<string, unknown> = {};
  for (const ref of placements) {
    if (typeof ref === "string") {
      const def = definitions?.[ref];
      if (def === undefined) {
        throw new OperationalError(
          `Referenced ${kind} '${ref}' but no definition found in config`,
        );
      }
      result[ref] = def;
    } else {
      const keys = Object.keys(ref);
      if (keys.length !== 1) {
        throw new OperationalError(
          `Inline ${kind} placement must have exactly one key`,
        );
      }
      const name = keys[0]!;
      result[name] = ref[name];
    }
  }
  return result;
}

export async function loadConfig(configPath: string): Promise<Config> {
  let content: string;
  try {
    content = await readFile(configPath, "utf-8");
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new OperationalError(`Config file not found: ${configPath}`);
    }
    throw err;
  }

  const parsed = parseYaml(content);
  const result = rawConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new OperationalError(`Invalid config:\n${issues}`);
  }

  const raw = result.data;
  const channelDefs = raw.channels;
  const sinkDefs = raw.sinks;

  const resolveAgent = (
    agent: z.infer<typeof rawAgentSchema>,
  ): AgentConfig => ({
    name: agent.name,
    ...(agent.interval !== undefined ? { interval: agent.interval } : {}),
    targets: agent.targets as TargetConfig[],
    channels: resolvePlacements(agent.channels, channelDefs, "channel"),
    sinks: resolvePlacements(agent.sinks, sinkDefs, "sink"),
  });

  const agents: Record<string, AgentConfig> = {};
  if (raw.agent) {
    agents.default = resolveAgent(raw.agent);
  }
  if (raw.agents) {
    for (const [id, agent] of Object.entries(raw.agents)) {
      agents[id] = resolveAgent(agent);
    }
  }

  const hub: HubConfig | undefined = raw.hub
    ? {
        name: raw.hub.name,
        listen: raw.hub.listen,
        channels: resolvePlacements(raw.hub.channels, channelDefs, "channel"),
        sinks: resolvePlacements(raw.hub.sinks, sinkDefs, "sink"),
      }
    : undefined;

  return {
    ...(hub ? { hub } : {}),
    providers: raw.providers ?? {},
    agents,
  };
}
