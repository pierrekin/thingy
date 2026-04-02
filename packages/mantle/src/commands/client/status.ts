import { defineCommand } from "citty";
import { loadConfig } from "../../config.ts";
import { handleOperationalErrors } from "../../errors.ts";
import { MantleClient } from "../../client/index.ts";
import type { ServerMessage } from "../../client/index.ts";
import { configArg, getHubConfig, getHubUrl } from "../shared.ts";

type TargetStatus = {
	provider: string;
	target: string;
	status: "green" | "red" | "grey" | null;
};

export const status = defineCommand({
	meta: { name: "status", description: "Show target statuses" },
	args: {
		config: configArg,
		hub: { type: "string", description: "Hub URL" },
	},
	run: handleOperationalErrors(async ({ args }) => {
		let hubUrl = args.hub;
		if (!hubUrl) {
			const config = await loadConfig(args.config);
			const hubConfig = getHubConfig(config);
			hubUrl = getHubUrl(hubConfig);
		}
		await runStatus(hubUrl);
	}),
});

async function runStatus(hubUrl: string): Promise<void> {
	const wsUrl = hubUrl.replace(/^http/, "ws") + "/api/ws";
	const client = new MantleClient(wsUrl);

	const statuses: TargetStatus[] = [];

	const timeout = setTimeout(() => {
		console.error("Timed out waiting for hub response");
		client.disconnect();
		process.exit(1);
	}, 10_000);

	await client.connect();

	client.snapshot("state", {
		start: Date.now() - 60_000,
		end: Date.now(),
		bucketDurationMs: 60_000,
	}, {
		onMessage: (msg: ServerMessage) => {
			if (msg.type === "target_status") {
				statuses.push({
					provider: msg.provider,
					target: msg.target,
					status: msg.status,
				});
			}
		},
		onComplete: () => {
			clearTimeout(timeout);
			printStatuses(statuses);
			client.disconnect();
		},
	});
}

function printStatuses(statuses: TargetStatus[]): void {
	if (statuses.length === 0) {
		console.log("No targets found.");
		return;
	}

	// Group by provider
	const byProvider = new Map<string, TargetStatus[]>();
	for (const s of statuses) {
		const list = byProvider.get(s.provider) ?? [];
		list.push(s);
		byProvider.set(s.provider, list);
	}

	for (const [provider, targets] of byProvider) {
		console.log(provider);
		for (const t of targets) {
			const color = formatStatus(t.status);
			console.log(`  ${t.target.padEnd(20)} ${color}`);
		}
	}
}

function formatStatus(status: "green" | "red" | "grey" | null): string {
	switch (status) {
		case "green":
			return "\x1b[32mgreen\x1b[0m";
		case "red":
			return "\x1b[31mred\x1b[0m";
		case "grey":
			return "\x1b[90mgrey\x1b[0m";
		default:
			return "\x1b[90munknown\x1b[0m";
	}
}
