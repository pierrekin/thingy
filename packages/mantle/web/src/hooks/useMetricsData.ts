import { useSyncExternalStore } from "react";
import { dataStore } from "../subscriptions/data-store";

export type MetricsDataPoint = {
	bucketStart: number;
	bucketEnd: number;
	mean: number | null;
};

/**
 * Hook to retrieve metrics data for a subscription.
 * Automatically re-renders when data updates.
 */
export function useMetricsData(
	subscriptionId: string,
	provider: string,
	target: string,
	check: string
): MetricsDataPoint[] {
	const data = useSyncExternalStore(
		(callback) => dataStore.subscribe(callback),
		() => {
			const buckets = dataStore.getMetricsBucketsForCheck(
				subscriptionId,
				provider,
				target,
				check
			);
			// Convert map to sorted array
			return Array.from(buckets.values()).sort((a, b) => a.bucketStart - b.bucketStart);
		}
	);

	return data;
}

/**
 * Hook to track metrics loading progress.
 */
export function useMetricsProgress(subscriptionId: string): {
	loaded: number;
	total: number;
	isComplete: boolean;
} {
	const progress = useSyncExternalStore(
		(callback) => dataStore.subscribe(callback),
		() => dataStore.getProgress(subscriptionId)
	);

	return {
		loaded: progress.index,
		total: progress.indexHwm,
		isComplete: progress.index >= progress.indexHwm && progress.indexHwm > 0,
	};
}
