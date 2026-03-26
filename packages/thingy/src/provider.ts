import type { z } from "zod";
import type { CheckResult } from "./framework/result.ts";

export interface ProviderInstance {
	check(target: unknown, checks: string[]): Promise<CheckResult[]>;
}

export interface Provider {
	name: string;
	providerConfigSchema: z.ZodType | null;
	targetConfigSchema: z.ZodType;
	createInstance?: (config: unknown) => ProviderInstance;
}
