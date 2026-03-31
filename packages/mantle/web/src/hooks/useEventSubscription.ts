import { useEffect, useMemo } from "react";
import { subscriptionManager } from "../subscriptions/manager";
import type { ConnectionStatus } from "./useWebSocket";
import type { EventSubscriptionParams } from "../subscriptions/types";

export function useEventSubscription(
	params: EventSubscriptionParams,
	send: (message: string) => void,
	connectionStatus: ConnectionStatus
): string {
	const subscriptionId = useMemo(() => {
		return subscriptionManager.createEventSubscription(params);
	}, [params]);

	useEffect(() => {
		if (connectionStatus !== "connected") return;

		send(JSON.stringify({
			type: "subscribe_event",
			id: subscriptionId,
			eventId: params.eventId,
			eventLevel: params.eventLevel,
		}));
	}, [connectionStatus, subscriptionId, params, send]);

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
