import { useMemo } from "react";
import type { Check } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";
import type { ConnectionStatus } from "../hooks/useWebSocket";
import { useMetricsSubscription } from "../hooks/useMetricsSubscription";
import { useMetricsData } from "../hooks/useMetricsData";
import { SparkChart } from "./SparkChart";
import type { MantleClient } from "../../../src/client/index.ts";

type Props = {
	provider: string;
	target: string;
	check: Check;
	client: MantleClient | null;
	connectionStatus: ConnectionStatus;
};

/**
 * Round a timestamp down to the nearest bucket boundary
 */
function roundDown(timestamp: number, bucketDurationMs: number): number {
	return Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
}

export function CheckRow({ provider, target, check, client, connectionStatus }: Props) {
	const hasEvents = check.events.length > 0;

	// Calculate metrics subscription params
	const now = useMemo(() => Date.now(), []);
	const lookbackMs = 60 * 60 * 1000; // 60 minutes lookback
	const bucketDurationMs = 1 * 60 * 1000; // 1 minute buckets for metrics
	const domainStart = roundDown(now - lookbackMs, bucketDurationMs);
	const domainEnd = now;

	const metricsParams = useMemo(() => ({
		provider,
		target,
		check: check.name,
		start: domainStart,
		end: null, // live mode
		bucketDurationMs,
	}), [provider, target, check.name, domainStart, bucketDurationMs]);

	// Subscribe to metrics
	const subscriptionId = useMetricsSubscription(metricsParams, client, connectionStatus);
	const metricsData = useMetricsData(subscriptionId ?? "", provider, target, check.name);

	return (
		<div className="bg-gray-100">
			<div className="px-4 py-2">
				<span className="text-sm text-gray-600">{check.name}</span>
			</div>
			<div className="px-4">
				<SparkChart data={metricsData} domainStart={domainStart} domainEnd={domainEnd} />
			</div>
			<StatusBar slots={check.statusSlots} />
			{hasEvents && (
				<div className="px-4 pb-2">
					<EventTable events={check.events} eventLevel="check" />
				</div>
			)}
		</div>
	);
}
