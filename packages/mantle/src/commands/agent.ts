import { defineCommand } from "citty";
import { handleOperationalErrors, OperationalError } from "mantle-framework";
import { startTargets, createHubConnection } from "mantle-agent";
import { createChannelInstances, startChannelWorker, createSinkInstances, startSinkWorker } from "mantle-hub";

export const agent = defineCommand({
	meta: { name: "agent", description: "Run agent" },
	args: {
		agent: {
			type: "string",
			description: "Agent ID (must match an agent defined in the hub's config)",
			required: true,
		},
		hub: {
			type: "string",
			description: "Hub URL",
			required: true,
		},
	},
	run: handleOperationalErrors(async ({ args }) => {
		const agentId = args.agent;
		const hubUrl = args.hub;

		if (!agentId) {
			throw new OperationalError("--agent <id> required");
		}
		if (!hubUrl) {
			throw new OperationalError("--hub <url> required");
		}

		const connection = createHubConnection(agentId, hubUrl);
		const hello = await connection.waitForHello();

		if (hello.type === "rejected") {
			console.error(`Hub rejected agent: ${hello.reason}`);
			process.exit(1);
		}

		const { instanceId, role, agentConfig, providerConfigs } = hello;
		console.log(`Assigned instance ${instanceId}, role: ${role}`);

		function startWork() {
			startTargets(agentId, agentConfig, providerConfigs, connection.checkReporter);

			for (const ch of createChannelInstances(agentConfig.channels)) {
				void startChannelWorker(hubUrl, ch.name, ch.instance);
			}

			for (const s of createSinkInstances(agentConfig.sinks)) {
				void startSinkWorker(hubUrl, s.name, s.instance);
			}
		}

		if (role === "leader") {
			startWork();
		} else {
			console.log("Standing by as standby...");
			connection.onPromote(() => {
				console.log("Promoted to leader");
				startWork();
			});
		}
	}),
});
