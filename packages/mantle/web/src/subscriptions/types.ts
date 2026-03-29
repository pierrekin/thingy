/**
 * Parameters for creating a state subscription.
 * Dashboard is the source of truth for these values.
 */
export type StateSubscriptionParams = {
	start: number; // unix timestamp ms (already aligned to bucket boundary)
	end: number | null; // null = live mode (rolling window)
	bucketDurationMs: number; // bucket size in milliseconds
};

/**
 * Metadata about an active subscription
 */
export type SubscriptionMetadata = {
	id: string;
	type: "state";
	params: StateSubscriptionParams;
	status: "pending" | "active" | "error";
	error?: string;
};
