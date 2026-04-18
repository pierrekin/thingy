import { defineCommand } from "citty";
import pkg from "../package.json" with { type: "json" };
import { agent } from "./commands/agent.ts";
import { status } from "./commands/client/status.ts";
import { cloud } from "./commands/cloud/index.ts";
import { hub } from "./commands/hub.ts";

export const main = defineCommand({
  meta: {
    name: "mantle",
    version: pkg.version,
    description: "Mantle CLI",
  },
  subCommands: {
    hub,
    agent,
    status,
    cloud,
  },
});
