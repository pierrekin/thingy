import { useState } from "react";
import { mockHub } from "./mock-data";
import { MainPage } from "./pages/MainPage";
import { InfrastructurePage } from "./pages/InfrastructurePage";

type Page = "main" | "infrastructure";

export default function App() {
	const [page, setPage] = useState<Page>("main");

	if (page === "infrastructure") {
		return (
			<InfrastructurePage
				hub={mockHub}
				onNavigateBack={() => setPage("main")}
			/>
		);
	}

	return (
		<MainPage
			hub={mockHub}
			onNavigateToInfra={() => setPage("infrastructure")}
		/>
	);
}
