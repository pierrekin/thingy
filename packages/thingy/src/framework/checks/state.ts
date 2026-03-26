import { z } from "zod";
import { defineCheck } from "../check.ts";

export const stateCheck = defineCheck({
  name: "state",
  measurement: z.object({ state: z.string() }),
  operators: ["equals", "not"] as const,
  defaults: { equals: "running", over: "5m" },
});
