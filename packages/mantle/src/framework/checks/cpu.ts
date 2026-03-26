import { z } from "zod";
import { defineCheck } from "../check.ts";

export const cpuCheck = defineCheck({
  name: "cpu",
  measurement: z.object({ usage_pct: z.number() }),
  operators: ["max", "min"] as const,
  defaults: { max: 80, over: "1m" },
});
