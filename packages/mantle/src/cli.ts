import { defineCommand } from "citty";
import { hub } from "./commands/hub.ts";
import { agent } from "./commands/agent.ts";
import { channel } from "./commands/channel.ts";
import { sink } from "./commands/sink.ts";
import { standalone } from "./commands/standalone.ts";
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
		channel,
		sink,
		standalone,
		status,
		cloud,
	},
});
