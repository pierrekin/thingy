import { useMemo } from "react";
import { useDataStore } from "../subscriptions/data-store";

export type MetricsDataPoint = {
	bucketStart: number;
	bucketEnd: number;
	mean: number | null;
};

/**
 * Hook to retrieve metrics data for a subscription.
 * Uses Zustand selector to automatically re-render when data updates.
 */
export function useMetricsData(
	subscriptionId: string,
	provider: string,
	target: string,
	check: string
): MetricsDataPoint[] {
	// Subscribe to the specific metrics bucket Map for this check
	const metricsBuckets = useDataStore((state) => {
		if (!subscriptionId) return undefined;
		const key = `${provider}/${target}/${check}`;
		const subBuckets = state.metricsBuckets.get(subscriptionId);
		return subBuckets?.get(key);
	});

	// Convert Map to sorted array - memoized so only recalculates when Map changes
	const data = useMemo(() => {
		if (!metricsBuckets) return [];
		return Array.from(metricsBuckets.values()).sort((a, b) => a.bucketStart - b.bucketStart);
	}, [metricsBuckets]);

	return data;
}

