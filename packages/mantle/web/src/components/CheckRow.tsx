import { useMemo } from "react";
import type { Check } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";
import type { ConnectionStatus } from "../hooks/useWebSocket";
import { useMetricsSubscription } from "../hooks/useMetricsSubscription";
import { useMetricsData } from "../hooks/useMetricsData";
import { SparkChart } from "./SparkChart";

type Props = {
	provider: string;
	target: string;
	check: Check;
	send: (message: string) => void;
	connectionStatus: ConnectionStatus;
};

/**
 * Round a timestamp down to the nearest bucket boundary
 */
function roundDown(timestamp: number, bucketDurationMs: number): number {
	return Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
}

export function CheckRow({ provider, target, check, send, connectionStatus }: Props) {
	const hasEvents = check.events.length > 0;

	// Calculate metrics subscription params
	const metricsParams = useMemo(() => {
		const now = Date.now();
		const bucketDurationMs = 1 * 60 * 1000; // 1 minute buckets for metrics
		const lookbackMs = 60 * 60 * 1000; // 60 minutes lookback

		return {
			provider,
			target,
			check: check.name,
			start: roundDown(now - lookbackMs, bucketDurationMs),
			end: null, // live mode
			bucketDurationMs,
		};
	}, [provider, target, check.name]);

	// Subscribe to metrics
	const subscriptionId = useMetricsSubscription(metricsParams, send, connectionStatus);
	const metricsData = useMetricsData(subscriptionId, provider, target, check.name);

	return (
		<div className="bg-gray-100">
			<div className="px-4 py-2 flex items-center justify-between">
				<span className="text-sm text-gray-600">{check.name}</span>
				{metricsData.length > 0 && (
					<div className="ml-4">
						<SparkChart data={metricsData} width={120} height={30} />
					</div>
				)}
			</div>
			<StatusBar slots={check.statusSlots} />
			{hasEvents && (
				<div className="px-4 pb-2">
					<EventTable events={check.events} />
				</div>
			)}
		</div>
	);
}
