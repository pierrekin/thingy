import { defineCommand } from "citty";
import { loadConfig, handleOperationalErrors, OperationalError } from "mantle-framework";
import { createSinkInstances, startSinkWorker } from "mantle-hub";
import { configArg } from "./shared.ts";

export const sink = defineCommand({
	meta: { name: "sink", description: "Run sink worker" },
	args: {
		config: configArg,
		sink: { type: "string", description: "Sink ID from config" },
		hub: { type: "string", description: "Hub URL" },
	},
	run: handleOperationalErrors(async ({ args }) => {
		const config = await loadConfig(args.config);

		const hubUrl = args.hub;
		if (!hubUrl) {
			throw new OperationalError("Hub URL required (--hub)");
		}

		const sinkConfigs = config.sinks ?? {};
		if (Object.keys(sinkConfigs).length === 0) {
			throw new OperationalError("No sinks defined in config");
		}

		const sinkId = args.sink;
		if (!sinkId) {
			throw new OperationalError("Sink ID required (--sink)");
		}

		if (!(sinkId in sinkConfigs)) {
			throw new OperationalError(
				`Sink '${sinkId}' not found. Available: ${Object.keys(sinkConfigs).join(", ")}`,
			);
		}

		const sinks = createSinkInstances({ [sinkId]: sinkConfigs[sinkId] });
		const s = sinks[0]!;

		void startSinkWorker(hubUrl, s.name, s.instance);
	}),
});
