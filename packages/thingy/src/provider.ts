import type { z } from "zod";

export interface Provider {
	name: string;
	providerConfigSchema: z.ZodType | null;
	targetConfigSchema: z.ZodType;
}
