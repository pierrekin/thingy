import type { z } from "zod";
import type { CheckResult } from "./framework/result.ts";
import type { ProviderDefinition } from "./framework/provider.ts";

export interface ProviderInstance {
	check(target: unknown, checks: string[]): Promise<CheckResult[]>;
}

export interface Provider {
	name: string;
	definition: ProviderDefinition;
	providerConfigSchema: z.ZodType | null;
	targetConfigSchema: z.ZodType;
	createInstance?: (config: unknown) => ProviderInstance;
}
