import { useEffect, useRef, useState, useCallback } from "react";
import { useDataStore } from "../subscriptions/data-store";
import { subscriptionManager } from "../subscriptions/manager";
import { MantleSocket } from "../lib/mantle-socket";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

type ServerMessage =
	| { type: "subscription_ack"; id: string }
	| { type: "subscription_error"; id: string; error: string }
	| { type: "provider_bucket"; subscriptionId: string; [key: string]: unknown }
	| { type: "target_bucket"; subscriptionId: string; [key: string]: unknown }
	| { type: "check_bucket"; subscriptionId: string; [key: string]: unknown }
	| { type: "metrics_bucket"; subscriptionId: string; [key: string]: unknown }
	| { type: "provider_event"; subscriptionId: string; [key: string]: unknown }
	| { type: "target_event"; subscriptionId: string; [key: string]: unknown }
	| { type: "check_event"; subscriptionId: string; [key: string]: unknown }
	| { type: "event_info"; subscriptionId: string; [key: string]: unknown }
	| { type: "event_outcome"; subscriptionId: string; [key: string]: unknown }
	| { type: "target_status"; subscriptionId: string; [key: string]: unknown };

/**
 * WebSocket hook that manages connection and message routing.
 * Uses the subscription protocol - data only flows after explicit subscription.
 */
export function useWebSocket() {
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const msRef = useRef<MantleSocket | null>(null);
	const reconnectTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		let cleaned = false;

		function handleMessage(msg: ServerMessage) {
			switch (msg.type) {
				case "subscription_ack":
					subscriptionManager.markActive(msg.id);
					break;

				case "subscription_error":
					subscriptionManager.markError(msg.id, msg.error);
					break;

				case "provider_bucket":
					useDataStore.getState().addProviderBucket(msg as any);
					break;

				case "target_bucket":
					useDataStore.getState().addTargetBucket(msg as any);
					break;

				case "check_bucket":
					useDataStore.getState().addCheckBucket(msg as any);
					break;

				case "metrics_bucket":
					useDataStore.getState().addMetricsBucket(msg as any);
					break;

				case "provider_event":
					useDataStore.getState().addProviderEvent(msg as any);
					break;

				case "target_event":
					useDataStore.getState().addTargetEvent(msg as any);
					break;

				case "check_event":
					useDataStore.getState().addCheckEvent(msg as any);
					break;

				case "event_info":
					useDataStore.getState().setEventInfo(msg as any);
					break;

				case "event_outcome":
					useDataStore.getState().addEventOutcome(msg as any);
					break;

				case "target_status":
					useDataStore.getState().setTargetStatus(msg as any);
					break;

				default:
					console.warn("Unknown message type:", (msg as any).type);
			}
		}

		function connect() {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const wsUrl = `${protocol}//${window.location.host}/api/ws`;

			setStatus("connecting");
			const ms = new MantleSocket(wsUrl);
			msRef.current = ms;

			ms.onopen = () => {
				if (cleaned) return;
				setStatus("connected");
			};

			ms.onmessage = (data) => {
				if (cleaned) return;
				try {
					const msg = JSON.parse(data) as ServerMessage;
					handleMessage(msg);
				} catch (error) {
					console.error("Error processing WebSocket message:", error);
				}
			};

			ms.onclose = () => {
				if (cleaned) return;
				setStatus("disconnected");
				msRef.current = null;

				// Reconnect after delay
				reconnectTimeoutRef.current = window.setTimeout(() => {
					connect();
				}, 2000);
			};

			ms.onerror = () => {
				ms.close();
			};

			return ms;
		}

		const ms = connect();

		return () => {
			cleaned = true;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			ms.close();
			msRef.current = null;
		};
	}, []);

	/**
	 * Send a message to the server
	 */
	const send = useCallback((message: string) => {
		if (msRef.current?.readyState === WebSocket.OPEN) {
			msRef.current.send(message);
		} else {
			console.warn("WebSocket not connected, cannot send message");
		}
	}, []);

	return { status, send, ws: msRef.current };
}
