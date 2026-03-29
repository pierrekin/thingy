import { useMemo } from "react";
import { useDataStore } from "../subscriptions/data-store";
import { subscriptionManager } from "../subscriptions/manager";
import { deriveHub } from "../subscriptions/derive-hub";
import type { Hub } from "../types";

/**
 * Hook to get the visible Hub data for a subscription.
 * Uses Zustand selector to automatically re-render only when relevant data changes.
 */
export function useVisibleHub(subscriptionId: string | null): Hub {
	// Subscribe to all relevant buckets and events for this subscription
	const providerBuckets = useDataStore((state) =>
		subscriptionId ? state.providerBuckets.get(subscriptionId) : undefined
	);
	const targetBuckets = useDataStore((state) =>
		subscriptionId ? state.targetBuckets.get(subscriptionId) : undefined
	);
	const checkBuckets = useDataStore((state) =>
		subscriptionId ? state.checkBuckets.get(subscriptionId) : undefined
	);
	const providerEvents = useDataStore((state) =>
		subscriptionId ? state.providerEvents.get(subscriptionId) : undefined
	);
	const targetEvents = useDataStore((state) =>
		subscriptionId ? state.targetEvents.get(subscriptionId) : undefined
	);
	const checkEvents = useDataStore((state) =>
		subscriptionId ? state.checkEvents.get(subscriptionId) : undefined
	);

	// Derive hub from the data - only recomputes when data changes
	const hub = useMemo(() => {
		if (!subscriptionId) {
			return { name: "Hub", providers: [], channels: [], targets: [] };
		}
		const params = subscriptionManager.getParams(subscriptionId);
		if (!params) {
			return { name: "Hub", providers: [], channels: [], targets: [] };
		}
		return deriveHub(subscriptionId, params);
	}, [subscriptionId, providerBuckets, targetBuckets, checkBuckets, providerEvents, targetEvents, checkEvents]);

	return hub;
}

/**
 * Hook to get loading progress for a subscription
 */
export function useLoadingProgress(subscriptionId: string | null): {
	progress: number;
	isLoading: boolean;
} {
	// Subscribe only to progress data for this subscription
	const progressData = useDataStore((state) =>
		subscriptionId ? state.progress.get(subscriptionId) : undefined
	);

	// Calculate progress percentage
	const progress = useMemo(() => {
		if (!progressData || progressData.indexHwm === 0) return 0;
		return Math.round((progressData.index / progressData.indexHwm) * 100);
	}, [progressData]);

	const isLoading = useMemo(() => {
		if (!progressData) return false;
		return progressData.index < progressData.indexHwm;
	}, [progressData]);

	return { progress, isLoading };
}
