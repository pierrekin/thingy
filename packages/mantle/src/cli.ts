import { defineCommand } from "citty";
import { hub } from "./commands/hub.ts";
import { agent } from "./commands/agent.ts";
import { standalone } from "./commands/standalone.ts";
import { status } from "./commands/client/status.ts";
import { cloud } from "./commands/cloud/index.ts";

export const main = defineCommand({
	meta: {
		name: "mantle",
		version: "0.0.10",
		description: "Mantle CLI",
	},
	subCommands: {
		hub,
		agent,
		standalone,
		status,
		cloud,
	},
});
