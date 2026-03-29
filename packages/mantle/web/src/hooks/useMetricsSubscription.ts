import { useEffect, useMemo } from "react";
import { subscriptionManager } from "../subscriptions/manager";
import type { ConnectionStatus } from "./useWebSocket";
import type { MetricsSubscriptionParams } from "../subscriptions/types";

export { type MetricsSubscriptionParams };

/**
 * Hook to subscribe to metrics for a specific check.
 * Creates subscription on mount, cleans up on unmount.
 */
export function useMetricsSubscription(
	params: MetricsSubscriptionParams,
	send: (message: string) => void,
	connectionStatus: ConnectionStatus
): string {
	const subscriptionId = useMemo(() => {
		return subscriptionManager.createMetricsSubscription(params);
	}, [params]);

	// Subscribe when connected
	useEffect(() => {
		if (connectionStatus !== "connected") return;

		const msg = {
			type: "subscribe_metrics",
			id: subscriptionId,
			provider: params.provider,
			target: params.target,
			check: params.check,
			start: params.start,
			end: params.end,
			bucketDurationMs: params.bucketDurationMs,
		};
		send(JSON.stringify(msg));
	}, [connectionStatus, subscriptionId, params, send]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (connectionStatus === "connected") {
				send(JSON.stringify({ type: "unsubscribe", id: subscriptionId }));
			}
			subscriptionManager.remove(subscriptionId);
		};
	}, [subscriptionId, send, connectionStatus]);

	return subscriptionId;
}
