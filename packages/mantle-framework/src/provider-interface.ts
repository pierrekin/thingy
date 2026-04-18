import type { z } from "zod";
import type { ProviderDefinition } from "./provider.ts";
import type { CheckResult } from "./result.ts";

export interface ProviderInstance {
  check(target: unknown, checks: string[]): Promise<CheckResult[]>;
  getErrorTitle(code: string): string;
}

export interface Provider {
  name: string;
  definition: ProviderDefinition;
  providerConfigSchema: z.ZodType | null;
  targetConfigSchema: z.ZodType;
  createInstance: (config: unknown) => ProviderInstance;
}
