import { useEffect, useState } from "react";
import { useDataStore } from "../subscriptions/data-store";
import type { ConnectionStatus } from "./useWebSocket";
import type { EventSubscriptionParams } from "../subscriptions/types";
import type { MantleClient } from "mantle/src/client/index.ts";
import type { ServerMessage } from "mantle/src/client/index.ts";

export function useEventSubscription(
	params: EventSubscriptionParams,
	client: MantleClient | null,
	connectionStatus: ConnectionStatus
): string {
	const [subscriptionId, setSubscriptionId] = useState<string>("");

	useEffect(() => {
		if (connectionStatus !== "connected" || !client) return;

		const handle = client.subscribe("event", {
			eventId: params.eventId,
			eventLevel: params.eventLevel,
		}, {
			onMessage: (msg: ServerMessage) => {
				const store = useDataStore.getState();
				switch (msg.type) {
					case "event_info":
						store.setEventInfo(msg);
						break;
					case "event_outcome":
						store.addEventOutcome(msg);
						break;
				}
			},
		});

		setSubscriptionId(handle.id);

		return () => {
			handle.unsubscribe();
		};
	}, [connectionStatus, client, params.eventId, params.eventLevel]);

	return subscriptionId;
}
