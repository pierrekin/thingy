import { defineCommand } from "citty";
import { login } from "./login.ts";
import { logout } from "./logout.ts";
import { whoami } from "./whoami.ts";
import { hub } from "./hub.ts";

export const cloud = defineCommand({
	meta: { name: "cloud", description: "Mantle Cloud" },
	subCommands: {
		login,
		logout,
		whoami,
		hub,
	},
});
