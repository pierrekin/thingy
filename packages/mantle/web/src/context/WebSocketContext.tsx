import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket, type ConnectionStatus } from "../hooks/useWebSocket";

type WebSocketContextValue = {
	send: (message: string) => void;
	status: ConnectionStatus;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
	const { send, status } = useWebSocket();

	return (
		<WebSocketContext.Provider value={{ send, status }}>
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
