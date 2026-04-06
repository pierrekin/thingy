import { useEffect, useState } from "react";
import { useDataStore } from "../subscriptions/data-store";
import type { ConnectionStatus } from "./useWebSocket";
import type { MetricsSubscriptionParams } from "../subscriptions/types";
import type { MantleClient } from "../../../src/client/index.ts";
import type { ServerMessage } from "../../../src/client/index.ts";

export { type MetricsSubscriptionParams };

/**
 * Hook to subscribe to metrics for a specific check.
 * Creates subscription on mount, cleans up on unmount.
 */
export function useMetricsSubscription(
	params: MetricsSubscriptionParams,
	client: MantleClient | null,
	connectionStatus: ConnectionStatus
): string | null {
	const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

	useEffect(() => {
		if (connectionStatus !== "connected" || !client) {
			setSubscriptionId(null);
			return;
		}

		const handle = client.subscribe("metrics", {
			provider: params.provider,
			target: params.target,
			check: params.check,
			start: params.start,
			end: params.end,
			bucketDurationMs: params.bucketDurationMs,
		}, {
			onMessage: (msg: ServerMessage) => {
				if (msg.type === "metrics_bucket") {
					useDataStore.getState().addMetricsBucket(msg);
				}
			},
		});

		setSubscriptionId(handle.id);

		return () => {
			handle.unsubscribe();
		};
	}, [connectionStatus, client, params.provider, params.target, params.check, params.start, params.end, params.bucketDurationMs]);

	return subscriptionId;
}
