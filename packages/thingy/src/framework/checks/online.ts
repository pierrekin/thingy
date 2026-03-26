import { z } from "zod";
import { defineCheck } from "../check.ts";

export const onlineCheck = defineCheck({
  name: "online",
  measurement: z.object({ online: z.boolean() }),
  operators: ["equals"] as const,
  defaults: { equals: true, over: "1m" },
});
