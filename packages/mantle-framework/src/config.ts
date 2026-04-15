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
	})
	.passthrough();

const placementRefSchema = z.union([
	z.string(),
	z.record(z.string(), z.unknown()),
]);

type PlacementRef = z.infer<typeof placementRefSchema>;

const agentSchema = z.object({
	name: z.string(),
	interval: z.string().optional(),
	targets: z.array(targetSchema),
	channels: z.array(placementRefSchema).optional(),
	sinks: z.array(placementRefSchema).optional(),
});

const hubSchema = z.object({
	name: z.string(),
	listen: listenSchema,
	channels: z.array(placementRefSchema).optional(),
	sinks: z.array(placementRefSchema).optional(),
});

const configSchema = z
	.object({
		hub: hubSchema.optional(),
		providers: z.record(z.string(), z.unknown()).optional(),
		channels: z.record(z.string(), z.unknown()).optional(),
		sinks: z.record(z.string(), z.unknown()).optional(),
		agent: agentSchema.optional(),
		agents: z.record(z.string(), agentSchema).optional(),
	})
	.refine((data) => !(data.agent && data.agents), {
		message: "Cannot specify both 'agent' and 'agents'",
	});

export type Config = z.infer<typeof configSchema>;
export type HubConfig = z.infer<typeof hubSchema>;
export type AgentConfig = z.infer<typeof agentSchema>;

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
	const result = configSchema.safeParse(parsed);

	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new OperationalError(`Invalid config:\n${issues}`);
	}

	return result.data;
}

export function resolvePlacements(
	placements: PlacementRef[] | undefined,
	definitions: Record<string, unknown> | undefined,
): Record<string, unknown> {
	if (!placements) return {};
	const result: Record<string, unknown> = {};
	for (const ref of placements) {
		if (typeof ref === "string") {
			const def = definitions?.[ref];
			if (def === undefined) {
				throw new OperationalError(`Referenced '${ref}' but no definition found in config`);
			}
			result[ref] = def;
		} else {
			const keys = Object.keys(ref);
			if (keys.length !== 1) {
				throw new OperationalError("Inline placement must have exactly one key");
			}
			const name = keys[0]!;
			result[name] = ref[name];
		}
	}
	return result;
}
