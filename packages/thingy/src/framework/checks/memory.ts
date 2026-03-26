import { z } from "zod";
import { defineCheck } from "../check.ts";

export const memoryCheck = defineCheck({
  name: "memory",
  measurement: z.object({ usage_pct: z.number() }),
  operators: ["max", "min"] as const,
  defaults: { max: 90, over: "1m" },
});
