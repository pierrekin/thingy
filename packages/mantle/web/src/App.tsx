import { useState, useMemo } from "react";
import { WebSocketProvider, useWebSocketContext } from "./context/WebSocketContext";
import { useStateSubscription } from "./hooks/useStateSubscription";
import { useVisibleHub, useLoadingProgress } from "./hooks/useVisibleHub";
import { MainPage } from "./pages/MainPage";
import { InfrastructurePage } from "./pages/InfrastructurePage";

type Page = "main" | "infrastructure";

function LoadingBar({ progress }: { progress: number }) {
	return (
		<div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
			<div className="h-full bg-blue-500 transition-all duration-150" style={{ width: `${progress}%` }} />
		</div>
	);
}

/**
 * Round a timestamp down to the nearest bucket boundary
 */
function roundDown(timestamp: number, bucketDurationMs: number): number {
	return Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
}

function AppContent() {
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
	console.log("App render", { subscriptionId, status });

	// Query visible data
	const hub = useVisibleHub(subscriptionId);
	const { progress, isLoading: loading } = useLoadingProgress(subscriptionId);
	console.log("App hub", { hub, targetCount: hub.targets.length });

	if (page === "infrastructure") {
		return (
			<>
				{loading && <LoadingBar progress={progress} />}
				<InfrastructurePage hub={hub} onNavigateBack={() => setPage("main")} />
			</>
		);
	}

	return (
		<>
			{loading && <LoadingBar progress={progress} />}
			<MainPage hub={hub} onNavigateToInfra={() => setPage("infrastructure")} />
			{status === "disconnected" && (
				<div className="fixed bottom-4 right-4 bg-red-500 text-white px-3 py-2 rounded-md text-sm">
					Disconnected - Reconnecting...
				</div>
			)}
		</>
	);
}

export default function App() {
	return (
		<WebSocketProvider>
			<AppContent />
		</WebSocketProvider>
	);
}
