import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { deriveHub, getLoadingProgress, isLoading } from "./store";
import { MainPage } from "./pages/MainPage";
import { InfrastructurePage } from "./pages/InfrastructurePage";

type Page = "main" | "infrastructure";

function LoadingBar({ progress }: { progress: number }) {
	return (
		<div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
			<div
				className="h-full bg-blue-500 transition-all duration-150"
				style={{ width: `${progress}%` }}
			/>
		</div>
	);
}

export default function App() {
	const [page, setPage] = useState<Page>("main");
	const { store, status } = useWebSocket();

	const hub = deriveHub(store);
	const loading = isLoading(store);
	const progress = getLoadingProgress(store);

	if (page === "infrastructure") {
		return (
			<>
				{loading && <LoadingBar progress={progress} />}
				<InfrastructurePage
					hub={hub}
					onNavigateBack={() => setPage("main")}
				/>
			</>
		);
	}

	return (
		<>
			{loading && <LoadingBar progress={progress} />}
			<MainPage
				hub={hub}
				onNavigateToInfra={() => setPage("infrastructure")}
			/>
			{status === "disconnected" && (
				<div className="fixed bottom-4 right-4 bg-red-500 text-white px-3 py-2 rounded-md text-sm">
					Disconnected - Reconnecting...
				</div>
			)}
		</>
	);
}
