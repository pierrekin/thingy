import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket, type ConnectionStatus } from "../hooks/useWebSocket";
import type { MantleClient } from "../../../src/client/index.ts";

type WebSocketContextValue = {
	client: MantleClient | null;
	status: ConnectionStatus;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
	const { client, status } = useWebSocket();

	return (
		<WebSocketContext.Provider value={{ client, status }}>
			{children}
		</WebSocketContext.Provider>
	);
}

export function useWebSocketContext(): WebSocketContextValue {
	const context = useContext(WebSocketContext);
	if (!context) {
		throw new Error("useWebSocketContext must be used within WebSocketProvider");
	}
	return context;
}
