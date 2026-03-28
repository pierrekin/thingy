import { useEffect, useRef, useState } from "react";
import type { WebSocketMessage } from "../types";
import type { Store } from "../store";
import {
	createStore,
	updateStoreWithProviderBucket,
	updateStoreWithTargetBucket,
	updateStoreWithCheckBucket,
	updateStoreWithProviderEvent,
	updateStoreWithTargetEvent,
	updateStoreWithCheckEvent,
} from "../store";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

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
					switch (msg.type) {
						case "provider_bucket":
							setStore((prev) => updateStoreWithProviderBucket(prev, msg));
							break;
						case "target_bucket":
							setStore((prev) => updateStoreWithTargetBucket(prev, msg));
							break;
						case "check_bucket":
							setStore((prev) => updateStoreWithCheckBucket(prev, msg));
							break;
						case "provider_event":
							setStore((prev) => updateStoreWithProviderEvent(prev, msg));
							break;
						case "target_event":
							setStore((prev) => updateStoreWithTargetEvent(prev, msg));
							break;
						case "check_event":
							setStore((prev) => updateStoreWithCheckEvent(prev, msg));
							break;
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
