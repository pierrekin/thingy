import { useEffect, useState } from "react";
import { subscriptionManager } from "../subscriptions/manager";
import type { StateSubscriptionParams } from "../subscriptions/types";
import { useWebSocket } from "./useWebSocket";

/**
 * Hook to create and manage a state subscription.
 * Returns the subscription ID that can be used to query display data.
 *
 * The subscription is automatically created on mount and cleaned up on unmount.
 * If params change, the old subscription is torn down and a new one is created.
 */
export function useStateSubscription(params: StateSubscriptionParams): string | null {
	const { send, status } = useWebSocket();
	const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

	useEffect(() => {
		// Only create subscription when connected
		if (status !== "connected") {
			setSubscriptionId(null);
			return;
		}

		// Create new subscription
		const id = subscriptionManager.createStateSubscription(params);
		setSubscriptionId(id);

		// Send subscription request
		send(
			JSON.stringify({
				type: "subscribe_state",
				id,
				start: params.start,
				end: params.end,
				bucketDurationMs: params.bucketDurationMs,
			}),
		);

		// Cleanup: unsubscribe when unmounting or params change
		return () => {
			if (id) {
				send(
					JSON.stringify({
						type: "unsubscribe",
						id,
					}),
				);
				subscriptionManager.remove(id);
			}
		};
	}, [status, params.start, params.end, params.bucketDurationMs, send]);

	return subscriptionId;
}
