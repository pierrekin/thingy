import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors, OperationalError } from "mantle-framework";
import { createChannelInstances, startChannelWorker } from "mantle-hub";
import { configArg } from "./shared.ts";

export const channel = defineCommand({
	meta: { name: "channel", description: "Run channel worker" },
	args: {
		config: configArg,
		channel: { type: "string", description: "Channel ID from config" },
		hub: { type: "string", description: "Hub URL" },
	},
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);

		const hubUrl = args.hub;
		if (!hubUrl) {
			throw new OperationalError("Hub URL required (--hub)");
		}

		const channelConfigs = config.channels ?? {};
		if (Object.keys(channelConfigs).length === 0) {
			throw new OperationalError("No channels defined in config");
		}

		const channelId = args.channel;
		if (!channelId) {
			throw new OperationalError("Channel ID required (--channel)");
		}

		if (!(channelId in channelConfigs)) {
			throw new OperationalError(
				`Channel '${channelId}' not found. Available: ${Object.keys(channelConfigs).join(", ")}`,
			);
		}

		const channels = createChannelInstances({ [channelId]: channelConfigs[channelId] });
		const ch = channels[0]!;

		void startChannelWorker(hubUrl, ch.name, ch.instance);
	}),
});
