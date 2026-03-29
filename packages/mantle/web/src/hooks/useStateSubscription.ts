import { useEffect, useRef } from "react";
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
	const subscriptionIdRef = useRef<string | null>(null);
	const paramsRef = useRef<StateSubscriptionParams>(params);

	// Track if params changed
	const paramsChanged =
		paramsRef.current.start !== params.start ||
		paramsRef.current.end !== params.end ||
		paramsRef.current.bucketDurationMs !== params.bucketDurationMs;

	useEffect(() => {
		// Only create subscription when connected
		if (status !== "connected") {
			return;
		}

		// Create new subscription
		const id = subscriptionManager.createStateSubscription(params);
		subscriptionIdRef.current = id;
		paramsRef.current = params;

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
			if (subscriptionIdRef.current) {
				send(
					JSON.stringify({
						type: "unsubscribe",
						id: subscriptionIdRef.current,
					}),
				);
				subscriptionManager.remove(subscriptionIdRef.current);
				subscriptionIdRef.current = null;
			}
		};
	}, [status, params.start, params.end, params.bucketDurationMs, send]);

	return subscriptionIdRef.current;
}
