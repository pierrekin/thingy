import { useEffect, useRef, useState } from "react";
import { MantleClient } from "../../../src/client/index.ts";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * WebSocket hook that manages a MantleClient connection lifecycle.
 * Handles auto-reconnect on disconnect.
 */
export function useWebSocket() {
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const clientRef = useRef<MantleClient | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		let cleaned = false;

		function connect() {
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const wsUrl = `${protocol}//${window.location.host}/api/ws`;

			setStatus("connecting");
			const client = new MantleClient(wsUrl);
			clientRef.current = client;

			client.onDisconnect(() => {
				if (cleaned) return;
				setStatus("disconnected");
				clientRef.current = null;

				reconnectTimeoutRef.current = setTimeout(() => {
					connect();
				}, 2000);
			});

			client.connect()
				.then(() => {
					if (cleaned) return;
					setStatus("connected");
				})
				.catch(() => {
					// onDisconnect will handle reconnect
				});
		}

		connect();

		return () => {
			cleaned = true;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			clientRef.current?.disconnect();
			clientRef.current = null;
		};
	}, []);

	return { client: clientRef.current, status };
}
