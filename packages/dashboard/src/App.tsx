import { useState, useMemo } from "react";
import { WebSocketProvider, useWebSocketContext } from "./context/WebSocketContext";
import { useStateSubscription } from "./hooks/useStateSubscription";
import { useVisibleHub } from "./hooks/useVisibleHub";
import { MainPage } from "./pages/MainPage";
import { InfrastructurePage } from "./pages/InfrastructurePage";

type Page = "main" | "infrastructure";

/**
 * Round a timestamp down to the nearest bucket boundary
 */
function roundDown(timestamp: number, bucketDurationMs: number): number {
	return Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
}

export function AppContent() {
	const [page, setPage] = useState<Page>("main");
	const { status } = useWebSocketContext();

	// Calculate display window (dashboard is source of truth)
	const subscriptionParams = useMemo(() => {
		const now = Date.now();
		const bucketDurationMs = 5 * 60 * 1000; // 5 minutes
		const lookbackMs = 60 * 60 * 1000; // 60 minutes

		return {
			start: roundDown(now - lookbackMs, bucketDurationMs),
			end: null, // live mode
			bucketDurationMs,
		};
	}, []); // Static for now - will add time controls later

	// Create state subscription
	const subscriptionId = useStateSubscription(subscriptionParams);
	// Query visible data
	const hub = useVisibleHub(subscriptionId, subscriptionParams);

	if (page === "infrastructure") {
		return (
			<InfrastructurePage hub={hub} onNavigateBack={() => setPage("main")} />
		);
	}

	return (
		<>
			<MainPage hub={hub} onNavigateToInfra={() => setPage("infrastructure")} />
			{status === "disconnected" && (
				<div className="fixed bottom-4 right-4 bg-red-500 text-white px-3 py-2 rounded-md text-sm">
					Disconnected - Reconnecting...
				</div>
			)}
		</>
	);
}

type AppProps = {
	getAuthToken?: () => Promise<string | null>;
};

export default function App({ getAuthToken }: AppProps) {
	return (
		<WebSocketProvider getAuthToken={getAuthToken}>
			<div className="mx-auto max-w-md min-h-screen">
				<AppContent />
			</div>
		</WebSocketProvider>
	);
}
