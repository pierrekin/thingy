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
 * Parameters for creating a metrics subscription.
 */
export type MetricsSubscriptionParams = {
  provider: string;
  target: string;
  check: string;
  start: number;
  end: number | null;
  bucketDurationMs: number;
};

/**
 * Parameters for subscribing to an event's details and outcomes.
 */
export type EventSubscriptionParams = {
  eventId: number;
  eventLevel: "provider" | "target" | "check";
};

/**
 * Metadata about an active subscription
 */
export type SubscriptionMetadata =
  | {
      id: string;
      type: "state";
      params: StateSubscriptionParams;
      status: "pending" | "active" | "error";
      error?: string;
    }
  | {
      id: string;
      type: "metrics";
      params: MetricsSubscriptionParams;
      status: "pending" | "active" | "error";
      error?: string;
    }
  | {
      id: string;
      type: "event";
      params: EventSubscriptionParams;
      status: "pending" | "active" | "error";
      error?: string;
    };
