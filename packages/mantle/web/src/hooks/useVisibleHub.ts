import { useDataStore } from "../subscriptions/data-store";
import { subscriptionManager } from "../subscriptions/manager";
import { deriveHub } from "../subscriptions/derive-hub";
import type { Hub } from "../types";
import { useRef, useEffect, useState } from "react";

/**
 * Hook to get the visible Hub data for a subscription.
 * Uses a single Zustand subscription with debouncing to avoid cascade re-renders.
 */
export function useVisibleHub(subscriptionId: string | null): Hub {
	const [hub, setHub] = useState<Hub>({ name: "Hub", providers: [], channels: [], targets: [] });
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (!subscriptionId) {
			setHub({ name: "Hub", providers: [], channels: [], targets: [] });
			return;
		}

		const params = subscriptionManager.getParams(subscriptionId);
		if (!params) {
			setHub({ name: "Hub", providers: [], channels: [], targets: [] });
			return;
		}

		// Initial render
		setHub(deriveHub(subscriptionId, params));

		// Subscribe to store changes with RAF debouncing
		const unsubscribe = useDataStore.subscribe(() => {
			// Cancel any pending RAF
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}

			// Schedule update on next animation frame (batches multiple updates)
			rafRef.current = requestAnimationFrame(() => {
				const params = subscriptionManager.getParams(subscriptionId);
				if (params) {
					setHub(deriveHub(subscriptionId, params));
				}
				rafRef.current = null;
			});
		});

		return () => {
			unsubscribe();
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [subscriptionId]);

	return hub;
}

/**
 * Hook to get loading progress for a subscription
 * Uses RAF debouncing to avoid re-rendering on every progress update
 */
export function useLoadingProgress(subscriptionId: string | null): {
	progress: number;
	isLoading: boolean;
} {
	const [state, setState] = useState({ progress: 0, isLoading: false });
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (!subscriptionId) {
			setState({ progress: 0, isLoading: false });
			return;
		}

		// Subscribe to store changes with RAF debouncing
		const unsubscribe = useDataStore.subscribe(() => {
			// Cancel any pending RAF
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}

			// Schedule update on next animation frame
			rafRef.current = requestAnimationFrame(() => {
				const progressData = useDataStore.getState().progress.get(subscriptionId);
				if (progressData) {
					const progress = progressData.indexHwm > 0
						? Math.round((progressData.index / progressData.indexHwm) * 100)
						: 0;
					const isLoading = progressData.index < progressData.indexHwm;
					setState({ progress, isLoading });
				}
				rafRef.current = null;
			});
		});

		// Initial state
		const progressData = useDataStore.getState().progress.get(subscriptionId);
		if (progressData) {
			const progress = progressData.indexHwm > 0
				? Math.round((progressData.index / progressData.indexHwm) * 100)
				: 0;
			const isLoading = progressData.index < progressData.indexHwm;
			setState({ progress, isLoading });
		}

		return () => {
			unsubscribe();
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [subscriptionId]);

	return state;
}
