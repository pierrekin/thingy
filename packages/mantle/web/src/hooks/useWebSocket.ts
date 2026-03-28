import { useEffect, useRef, useState } from "react";
import type { BucketMessage, EventMessage } from "../types";
import type { Store } from "../store";
import { createStore, updateStoreWithBucket, updateStoreWithEvent } from "../store";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

type WebSocketMessage = BucketMessage | EventMessage;

export function useWebSocket() {
	const [store, setStore] = useState<Store>(createStore);
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const reconnectTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		let cleaned = false;

		function connect() {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const wsUrl = `${protocol}//${window.location.host}/api/ws`;

			setStatus("connecting");
			const ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				if (cleaned) return;
				setStatus("connected");
			};

			ws.onmessage = (event) => {
				if (cleaned) return;
				try {
					const msg = JSON.parse(event.data) as WebSocketMessage;
					if (msg.type === "bucket_state") {
						setStore((prev) => updateStoreWithBucket(prev, msg));
					} else if (msg.type === "event") {
						setStore((prev) => updateStoreWithEvent(prev, msg));
					}
				} catch {
					// Ignore invalid messages
				}
			};

			ws.onclose = () => {
				if (cleaned) return;
				setStatus("disconnected");

				reconnectTimeoutRef.current = window.setTimeout(() => {
					connect();
				}, 2000);
			};

			ws.onerror = () => {
				ws.close();
			};

			return ws;
		}

		const ws = connect();

		return () => {
			cleaned = true;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			ws.close();
		};
	}, []);

	return { store, status };
}
