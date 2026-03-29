import { useEffect, useState } from "react";
import { displayStore } from "../subscriptions/display-store";
import { dataStore } from "../subscriptions/data-store";
import type { Hub } from "../types";

/**
 * Hook to get the visible Hub data for a subscription.
 * Automatically re-renders when data changes.
 */
export function useVisibleHub(subscriptionId: string | null): Hub {
	const [hub, setHub] = useState<Hub>(() =>
		subscriptionId ? displayStore.deriveHub(subscriptionId) : { name: "Hub", providers: [], channels: [], targets: [] },
	);

	useEffect(() => {
		console.log("useVisibleHub effect", { subscriptionId });
		if (!subscriptionId) {
			setHub({ name: "Hub", providers: [], channels: [], targets: [] });
			return;
		}

		// Initial load
		const initialHub = displayStore.deriveHub(subscriptionId);
		console.log("Initial hub", initialHub);
		setHub(initialHub);

		// Subscribe to data changes
		const unsubscribe = dataStore.subscribe(() => {
			console.log("Data changed, re-deriving hub");
			setHub(displayStore.deriveHub(subscriptionId));
		});

		return unsubscribe;
	}, [subscriptionId]);

	return hub;
}

/**
 * Hook to get loading progress for a subscription
 */
export function useLoadingProgress(subscriptionId: string | null): {
	progress: number;
	isLoading: boolean;
} {
	const [state, setState] = useState(() => ({
		progress: subscriptionId ? displayStore.getLoadingProgress(subscriptionId) : 0,
		isLoading: subscriptionId ? displayStore.isLoading(subscriptionId) : false,
	}));

	useEffect(() => {
		if (!subscriptionId) {
			setState({ progress: 0, isLoading: false });
			return;
		}

		// Initial state
		setState({
			progress: displayStore.getLoadingProgress(subscriptionId),
			isLoading: displayStore.isLoading(subscriptionId),
		});

		// Subscribe to changes
		const unsubscribe = dataStore.subscribe(() => {
			setState({
				progress: displayStore.getLoadingProgress(subscriptionId),
				isLoading: displayStore.isLoading(subscriptionId),
			});
		});

		return unsubscribe;
	}, [subscriptionId]);

	return state;
}
