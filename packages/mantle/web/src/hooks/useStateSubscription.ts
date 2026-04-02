import { useEffect, useState } from "react";
import { useWebSocketContext } from "../context/WebSocketContext";
import { useDataStore } from "../subscriptions/data-store";
import type { StateSubscriptionParams } from "../subscriptions/types";
import type { ServerMessage } from "../../../src/client/index.ts";

/**
 * Hook to create and manage a state subscription.
 * Returns the subscription ID that can be used to query display data.
 */
export function useStateSubscription(params: StateSubscriptionParams): string | null {
	const { client, status } = useWebSocketContext();
	const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

	useEffect(() => {
		if (status !== "connected" || !client) {
			setSubscriptionId(null);
			return;
		}

		const handle = client.subscribe("state", {
			start: params.start,
			end: params.end,
			bucketDurationMs: params.bucketDurationMs,
		}, {
			onMessage: (msg: ServerMessage) => {
				const store = useDataStore.getState();
				switch (msg.type) {
					case "provider_bucket":
						store.addProviderBucket(msg);
						break;
					case "target_bucket":
						store.addTargetBucket(msg);
						break;
					case "check_bucket":
						store.addCheckBucket(msg);
						break;
					case "channel_bucket":
						store.addChannelBucket(msg);
						break;
					case "provider_event":
						store.addProviderEvent(msg);
						break;
					case "target_event":
						store.addTargetEvent(msg);
						break;
					case "check_event":
						store.addCheckEvent(msg);
						break;
					case "channel_event":
						store.addChannelEvent(msg);
						break;
					case "target_status":
						store.setTargetStatus(msg);
						break;
				}
			},
		});

		setSubscriptionId(handle.id);

		return () => {
			handle.unsubscribe();
			useDataStore.getState().clearSubscription(handle.id);
		};
	}, [status, client, params.start, params.end, params.bucketDurationMs]);

	return subscriptionId;
}
