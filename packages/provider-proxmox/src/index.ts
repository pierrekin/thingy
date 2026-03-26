import { z } from "zod";
import type { Provider } from "../../thingy/src/provider.ts";

const ENABLED = "__enabled__";
const DISABLED = "__disabled__";

const stateCheckConfigSchema = z.object({
	state: z.enum(["running", "stopped"]),
});

const stateCheckSchema = z.union([
	z.literal(DISABLED),
	z.literal(ENABLED),
	stateCheckConfigSchema,
]);

const onlineCheckConfigSchema = z.object({
	// Currently no config options, but structured for future expansion
});

const onlineCheckSchema = z.union([
	z.literal(DISABLED),
	z.literal(ENABLED),
	onlineCheckConfigSchema,
]);

const vmChecksSchema = z
	.object({
		state: stateCheckSchema.optional(),
	})
	.optional();

const lxcChecksSchema = z
	.object({
		state: stateCheckSchema.optional(),
	})
	.optional();

const nodeChecksSchema = z
	.object({
		online: onlineCheckSchema.optional(),
	})
	.optional();

const providerChecksSchema = z
	.object({
		vm: vmChecksSchema,
		lxc: lxcChecksSchema,
		node: nodeChecksSchema,
	})
	.optional();

const intervalsSchema = z
	.object({
		vm: z.string().optional(),
		lxc: z.string().optional(),
		node: z.string().optional(),
	})
	.optional();

export const providerConfigSchema = z.object({
	type: z.literal("proxmox").optional(),
	url: z.string(),
	tokenId: z.string(),
	tokenSecret: z.string(),
	interval: z.string().optional(),
	intervals: intervalsSchema,
	checks: providerChecksSchema,
});

const baseTarget = {
	name: z.string(),
	provider: z.string(),
};

const nodeTargetSchema = z.object({
	...baseTarget,
	type: z.literal("node"),
	node: z.string(),
	interval: z.string().optional(),
	checks: nodeChecksSchema,
});

const vmTargetSchema = z.object({
	...baseTarget,
	type: z.literal("vm"),
	vmId: z.number(),
	interval: z.string().optional(),
	checks: vmChecksSchema,
});

const lxcTargetSchema = z.object({
	...baseTarget,
	type: z.literal("lxc"),
	vmId: z.number(),
	interval: z.string().optional(),
	checks: lxcChecksSchema,
});

export const targetConfigSchema = z.discriminatedUnion("type", [
	nodeTargetSchema,
	vmTargetSchema,
	lxcTargetSchema,
]);

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type TargetConfig = z.infer<typeof targetConfigSchema>;
export type NodeTarget = z.infer<typeof nodeTargetSchema>;
export type VmTarget = z.infer<typeof vmTargetSchema>;
export type LxcTarget = z.infer<typeof lxcTargetSchema>;

// Built-in defaults (used when __enabled__ or omitted)
const builtInDefaults = {
	vm: { state: { state: "running" as const }, interval: "30s" },
	lxc: { state: { state: "running" as const }, interval: "30s" },
	node: { online: {}, interval: "10s" },
};

const FRAMEWORK_FALLBACK_INTERVAL = "60s";

type StateCheckConfig = z.infer<typeof stateCheckConfigSchema>;
type OnlineCheckConfig = z.infer<typeof onlineCheckConfigSchema>;

type ResolvedVmChecks = { state: StateCheckConfig | false };
type ResolvedLxcChecks = { state: StateCheckConfig | false };
type ResolvedNodeChecks = { online: OnlineCheckConfig | false };

type CheckValue<T> = typeof DISABLED | typeof ENABLED | T | undefined;

function resolveCheck<T>(
	targetValue: CheckValue<T>,
	providerValue: CheckValue<T>,
	builtInDefault: T,
): T | false {
	// Target takes precedence
	const value = targetValue !== undefined ? targetValue : providerValue;

	if (value === DISABLED) return false;
	if (value === ENABLED || value === undefined) return builtInDefault;
	return value;
}

function resolveVmChecks(
	target: VmTarget,
	providerConfig: ProviderConfig,
): ResolvedVmChecks {
	const providerDefaults = providerConfig.checks?.vm;
	const state = resolveCheck(
		target.checks?.state,
		providerDefaults?.state,
		builtInDefaults.vm.state,
	);
	return { state };
}

function resolveLxcChecks(
	target: LxcTarget,
	providerConfig: ProviderConfig,
): ResolvedLxcChecks {
	const providerDefaults = providerConfig.checks?.lxc;
	const state = resolveCheck(
		target.checks?.state,
		providerDefaults?.state,
		builtInDefaults.lxc.state,
	);
	return { state };
}

function resolveNodeChecks(
	target: NodeTarget,
	providerConfig: ProviderConfig,
): ResolvedNodeChecks {
	const providerDefaults = providerConfig.checks?.node;
	const online = resolveCheck(
		target.checks?.online,
		providerDefaults?.online,
		builtInDefaults.node.online,
	);
	return { online };
}

export function resolveTargetChecks(
	target: TargetConfig,
	providerConfig: ProviderConfig,
): ResolvedVmChecks | ResolvedLxcChecks | ResolvedNodeChecks {
	switch (target.type) {
		case "vm":
			return resolveVmChecks(target, providerConfig);
		case "lxc":
			return resolveLxcChecks(target, providerConfig);
		case "node":
			return resolveNodeChecks(target, providerConfig);
	}
}

export function resolveInterval(
	target: TargetConfig,
	providerConfig: ProviderConfig,
	agentInterval: string | undefined,
): string {
	// 1. Target config
	if (target.interval) return target.interval;

	// 2. Provider config (per target-type)
	const providerTypeInterval = providerConfig.intervals?.[target.type];
	if (providerTypeInterval) return providerTypeInterval;

	// 3. Provider config (global)
	if (providerConfig.interval) return providerConfig.interval;

	// 4. Agent config
	if (agentInterval) return agentInterval;

	// 5. Provider built-in default
	const builtIn = builtInDefaults[target.type].interval;
	if (builtIn) return builtIn;

	// 6. Framework fallback
	return FRAMEWORK_FALLBACK_INTERVAL;
}

export function printResolvedConfig(
	targets: TargetConfig[],
	providerConfig: ProviderConfig,
	agentInterval: string | undefined,
): void {
	console.log("Proxmox Provider Config:");
	console.log(`  URL: ${providerConfig.url}`);
	console.log("");
	console.log("Resolved Targets:");
	for (const target of targets) {
		const checks = resolveTargetChecks(target, providerConfig);
		const interval = resolveInterval(target, providerConfig, agentInterval);
		console.log(`  ${target.name} (${target.type}):`);
		if (target.type === "node") {
			console.log(`    node: ${target.node}`);
		} else {
			console.log(`    vmId: ${target.vmId}`);
		}
		console.log(`    interval: ${interval}`);
		console.log(`    checks: ${JSON.stringify(checks)}`);
	}
}

export default {
	name: "proxmox",
	providerConfigSchema,
	targetConfigSchema,
} satisfies Provider;
