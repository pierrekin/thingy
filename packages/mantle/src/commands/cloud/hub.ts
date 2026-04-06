import { defineCommand } from "citty";

const apply = defineCommand({
	meta: { name: "apply", description: "Apply local config to cloud hub" },
	args: {
		config: { type: "string", description: "Path to config file", default: "config.yaml" },
	},
	run: async ({ args }) => {
		console.log(`TODO: mantle cloud hub apply (config: ${args.config})`);
	},
});

const show = defineCommand({
	meta: { name: "show", description: "Show current cloud hub config" },
	run: async () => {
		console.log("TODO: mantle cloud hub show");
	},
});

const diff = defineCommand({
	meta: { name: "diff", description: "Diff local config against cloud hub" },
	args: {
		config: { type: "string", description: "Path to config file", default: "config.yaml" },
	},
	run: async ({ args }) => {
		console.log(`TODO: mantle cloud hub diff (config: ${args.config})`);
	},
});

const rollback = defineCommand({
	meta: { name: "rollback", description: "Rollback cloud hub to previous config" },
	run: async () => {
		console.log("TODO: mantle cloud hub rollback");
	},
});

export const hub = defineCommand({
	meta: { name: "hub", description: "Manage cloud hub" },
	subCommands: {
		apply,
		show,
		diff,
		rollback,
	},
});
