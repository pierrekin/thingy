import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket, type ConnectionStatus, type GetAuthToken } from "../hooks/useWebSocket";
import type { MantleClient } from "@mantle-team/client";

type WebSocketContextValue = {
	client: MantleClient | null;
	status: ConnectionStatus;
};

type WebSocketProviderProps = {
	children: ReactNode;
	getAuthToken?: GetAuthToken;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children, getAuthToken }: WebSocketProviderProps) {
	const { client, status } = useWebSocket(getAuthToken);

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
