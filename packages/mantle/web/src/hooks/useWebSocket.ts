import { useEffect, useRef, useState } from "react";
import type { BucketMessage } from "../types";
import type { BucketStore } from "../store";
import { createStore, updateStore } from "../store";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useWebSocket() {
	const [store, setStore] = useState<BucketStore>(createStore);
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
					const msg = JSON.parse(event.data) as BucketMessage;
					if (msg.type === "bucket_state") {
						setStore((prev) => updateStore(prev, msg));
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
