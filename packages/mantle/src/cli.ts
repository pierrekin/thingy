import { defineCommand } from "citty";
import { hub } from "./commands/hub.ts";
import { agent } from "./commands/agent.ts";
import { status } from "./commands/client/status.ts";
import { cloud } from "./commands/cloud/index.ts";
import { version } from "../package.json";

export const main = defineCommand({
	meta: {
		name: "mantle",
		version,
		description: "Mantle CLI",
	},
	subCommands: {
		hub,
		agent,
		status,
		cloud,
	},
});
