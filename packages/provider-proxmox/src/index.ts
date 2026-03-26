import { z } from "zod";
import {
  defineCheck,
  defineProvider,
  bindCheck,
  resolveEnabledChecks,
  providerConfigSchema,
  allTargetConfigsSchema,
  DISABLED,
  type CheckResult,
} from "../../mantle/src/framework/index.ts";
import { ProxmoxClient } from "./client.ts";

// Proxmox-specific check definitions
const stateCheck = defineCheck({
  name: "state",
  measurement: z.object({ state: z.string() }),
  operators: ["equals", "not"] as const,
  defaults: { equals: "running", over: "5m" },
});

const onlineCheck = defineCheck({
  name: "online",
  measurement: z.object({ online: z.boolean() }),
  operators: ["equals"] as const,
  defaults: { equals: true, over: "1m" },
});

const cpuCheck = defineCheck({
  name: "cpu",
  measurement: z.object({ usage_pct: z.number() }),
  operators: ["max", "min"] as const,
  defaults: { max: 80, over: "5m" },
});

const memoryCheck = defineCheck({
  name: "memory",
  measurement: z.object({ usage_pct: z.number() }),
  operators: ["max", "min"] as const,
  defaults: { max: 90, over: "5m" },
});

const proxmoxConnectionConfig = z.object({
  url: z.string(),
  tokenId: z.string(),
  tokenSecret: z.string(),
});

export const proxmoxProvider = defineProvider({
  name: "proxmox",
  config: proxmoxConnectionConfig,
  defaultInterval: "30s",
  targetTypes: {
    vm: {
      schema: z.object({ vmId: z.number() }),
      checks: {
        state: bindCheck(stateCheck, {
          defaults: { equals: "running", over: "5m" },
        }),
        cpu: bindCheck(cpuCheck),
        memory: bindCheck(memoryCheck),
      },
      defaultInterval: "30s",
    },
    lxc: {
      schema: z.object({ vmId: z.number() }),
      checks: {
        state: bindCheck(stateCheck, {
          defaults: { equals: "running", over: "5m" },
        }),
        cpu: bindCheck(cpuCheck),
        memory: bindCheck(memoryCheck),
      },
      defaultInterval: "30s",
    },
    node: {
      schema: z.object({ node: z.string() }),
      checks: {
        online: bindCheck(onlineCheck, {
          defaults: { equals: true, over: "1m" },
        }),
        cpu: bindCheck(cpuCheck),
        memory: bindCheck(memoryCheck),
      },
      defaultInterval: "10s",
    },
  },
});

// Generate schemas from the provider definition
export const proxmoxProviderConfigSchema = providerConfigSchema(
  proxmoxProvider.config,
  proxmoxProvider.targetTypes,
  proxmoxProvider.name,
);

export const proxmoxTargetConfigSchema = allTargetConfigsSchema(
  proxmoxProvider.targetTypes,
);

export type ProxmoxProviderConfig = {
  url: string;
  tokenId: string;
  tokenSecret: string;
  type?: string;
  interval?: string;
  intervals?: Record<string, string>;
  checks?: Record<string, unknown>;
};
export type ProxmoxTargetConfig = z.infer<typeof proxmoxTargetConfigSchema>;

// Provider instance
export class ProxmoxProviderInstance {
  private client: ProxmoxClient;

  constructor(public config: ProxmoxProviderConfig) {
    this.client = new ProxmoxClient({
      url: config.url,
      tokenId: config.tokenId,
      tokenSecret: config.tokenSecret,
    });
  }

  async check(target: unknown, checks: string[]): Promise<CheckResult[]> {
    const t = target as { type: string; name: string; vmId?: number; node?: string };
    const results: CheckResult[] = [];

    for (const checkName of checks) {
      try {
        const measurement = await this.runCheck(t, checkName);
        results.push({ check: checkName, measurement });
      } catch (err) {
        results.push({
          check: checkName,
          error: {
            level: "target",
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    return results;
  }

  private async runCheck(
    target: { type: string; name: string; vmId?: number; node?: string },
    checkName: string
  ): Promise<Record<string, unknown>> {
    switch (target.type) {
      case "vm":
        return this.runVmCheck(target.vmId!, checkName);
      case "lxc":
        return this.runLxcCheck(target.vmId!, checkName);
      case "node":
        return this.runNodeCheck(target.node!, checkName);
      default:
        throw new Error(`Unknown target type: ${target.type}`);
    }
  }

  private async runVmCheck(vmId: number, checkName: string): Promise<Record<string, unknown>> {
    const node = await this.client.findVmNode(vmId, "qemu");
    if (!node) {
      throw new Error(`VM ${vmId} not found`);
    }

    const status = await this.client.getVmStatus(node, vmId);

    switch (checkName) {
      case "state":
        return { state: status.status };
      case "cpu":
        return { usage_pct: status.cpu * 100 };
      case "memory":
        return { usage_pct: (status.mem / status.maxmem) * 100 };
      default:
        throw new Error(`Unknown check for vm: ${checkName}`);
    }
  }

  private async runLxcCheck(vmId: number, checkName: string): Promise<Record<string, unknown>> {
    const node = await this.client.findVmNode(vmId, "lxc");
    if (!node) {
      throw new Error(`LXC ${vmId} not found`);
    }

    const status = await this.client.getLxcStatus(node, vmId);

    switch (checkName) {
      case "state":
        return { state: status.status };
      case "cpu":
        return { usage_pct: status.cpu * 100 };
      case "memory":
        return { usage_pct: (status.mem / status.maxmem) * 100 };
      default:
        throw new Error(`Unknown check for lxc: ${checkName}`);
    }
  }

  private async runNodeCheck(nodeName: string, checkName: string): Promise<Record<string, unknown>> {
    const status = await this.client.getNodeStatus(nodeName);

    switch (checkName) {
      case "online":
        return { online: true };
      case "cpu":
        return { usage_pct: status.cpu * 100 };
      case "memory":
        return { usage_pct: (status.memory.used / status.memory.total) * 100 };
      default:
        throw new Error(`Unknown check for node: ${checkName}`);
    }
  }
}

export default {
  name: "proxmox",
  definition: proxmoxProvider,
  providerConfigSchema: proxmoxProviderConfigSchema,
  targetConfigSchema: proxmoxTargetConfigSchema,
  createInstance: (config: unknown) => new ProxmoxProviderInstance(config as ProxmoxProviderConfig),
};
