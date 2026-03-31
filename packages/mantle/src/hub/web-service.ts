import type { ServerWebSocket } from "bun";
import type { BucketStore, EventStore, MetricsStore, OutcomeStore } from "../store/types.ts";
import type {
	ProviderBucketPublisher,
	TargetBucketPublisher,
	CheckBucketPublisher,
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
	OutcomePublisher,
} from "./pubsub.ts";
import {
	SubscriptionManager,
	StateSubscription,
	MetricsSubscription,
	EventDetailSubscription,
	type ClientMessage,
	type StateSubscriptionRequest,
	type MetricsSubscriptionRequest,
	type EventSubscriptionRequest,
	type UnsubscribeRequest,
	type ProviderBucketMessage,
	type TargetBucketMessage,
	type CheckBucketMessage,
	type MetricsBucketMessage,
	type ProviderEventMessage,
	type TargetEventMessage,
	type CheckEventMessage,
	type EventInfoMessage,
	type EventOutcomeMessage,
} from "./subscriptions/index.ts";
import { DEFAULT_BUCKET_CONFIG, type BucketConfig } from "./buckets.ts";

type WebSocketData = {
	audience: "web" | "agent";
};

type BucketPublishers = {
	provider: ProviderBucketPublisher;
	target: TargetBucketPublisher;
	check: CheckBucketPublisher;
};

type EventPublishers = {
	provider: ProviderEventPublisher;
	target: TargetEventPublisher;
	check: CheckEventPublisher;
};

/**
 * WebService manages WebSocket connections for web clients using the
 * subscription protocol. Clients explicitly subscribe to data streams
 * they need, and the service manages the lifecycle of those subscriptions.
 */
export class WebService {
	private subscriptionManager = new SubscriptionManager();

	constructor(
		private bucketStore: BucketStore,
		private eventStore: EventStore,
		private metricsStore: MetricsStore,
		private outcomeStore: OutcomeStore,
		private bucketPublishers: BucketPublishers,
		private eventPublishers: EventPublishers,
		private outcomePublisher: OutcomePublisher,
	) {}

	/**
	 * Handle incoming messages from web clients
	 */
	async handleMessage(ws: ServerWebSocket<WebSocketData>, message: string): Promise<void> {
		let msg: ClientMessage;
		try {
			msg = JSON.parse(message) as ClientMessage;
		} catch (error) {
			this.sendError(ws, undefined, "Invalid JSON");
			return;
		}

		switch (msg.type) {
			case "subscribe_state":
				await this.handleStateSubscription(ws, msg);
				break;
			case "subscribe_metrics":
				await this.handleMetricsSubscription(ws, msg);
				break;
			case "subscribe_event":
				await this.handleEventSubscription(ws, msg);
				break;
			case "unsubscribe":
				this.handleUnsubscribe(ws, msg);
				break;
			default:
				this.sendError(ws, undefined, `Unknown message type: ${(msg as { type: string }).type}`);
		}
	}

	/**
	 * Handle state subscription requests
	 */
	private async handleStateSubscription(
		ws: ServerWebSocket<WebSocketData>,
		req: StateSubscriptionRequest,
	): Promise<void> {
		// Validate request
		if (req.end !== null && req.end <= req.start) {
			this.sendError(ws, req.id, "Invalid time range: end must be after start");
			return;
		}

		if (req.bucketDurationMs <= 0) {
			this.sendError(ws, req.id, "Invalid bucket duration: must be positive");
			return;
		}

		// Create subscription
		const subscription = new StateSubscription(req.id, ws, req.start, req.end, req.bucketDurationMs);
		this.subscriptionManager.add(subscription);

		// Send acknowledgement
		ws.send(JSON.stringify({ type: "subscription_ack", id: req.id }));

		// Fetch and send historical data
		await this.sendInitialData(subscription, req);

		// Subscribe to real-time updates
		this.subscribeToRealTimeUpdates(subscription);
	}

	/**
	 * Handle metrics subscription requests
	 */
	private async handleMetricsSubscription(
		ws: ServerWebSocket<WebSocketData>,
		req: MetricsSubscriptionRequest,
	): Promise<void> {
		// Validate request
		if (req.end !== null && req.end <= req.start) {
			this.sendError(ws, req.id, "Invalid time range: end must be after start");
			return;
		}

		if (req.bucketDurationMs <= 0) {
			this.sendError(ws, req.id, "Invalid bucket duration: must be positive");
			return;
		}

		// Create subscription
		const subscription = new MetricsSubscription(
			req.id,
			ws,
			req.provider,
			req.target,
			req.check,
			req.start,
			req.end,
			req.bucketDurationMs,
		);
		this.subscriptionManager.add(subscription);

		// Send acknowledgement
		ws.send(JSON.stringify({ type: "subscription_ack", id: req.id }));

		// Fetch and send metrics data
		await this.sendMetricsData(subscription);
	}

	/**
	 * Send metrics data for a subscription
	 */
	private async sendMetricsData(subscription: MetricsSubscription): Promise<void> {
		const { provider, target, check, start, end } = subscription;
		const endTime = end ?? Date.now();

		// Query aggregated metrics from store
		const buckets = await this.metricsStore.getAggregatedMetrics(
			provider,
			target,
			check,
			start,
			endTime,
			subscription.bucketDurationMs,
		);

		// Calculate bucket count to determine if we need to fill gaps
		const expectedCount = Math.ceil((endTime - start) / subscription.bucketDurationMs);

		// Fill gaps with null buckets
		const filledBuckets = this.fillMetricsBuckets(
			buckets,
			provider,
			target,
			check,
			start,
			expectedCount,
			subscription.bucketDurationMs,
		);

		// Send all buckets
		const indexHwm = filledBuckets.length;
		for (let i = 0; i < filledBuckets.length; i++) {
			const bucket = filledBuckets[i];
			const msg: MetricsBucketMessage = {
				type: "metrics_bucket",
				subscriptionId: subscription.id,
				provider,
				target,
				check,
				bucketStart: bucket.bucketStart,
				bucketEnd: bucket.bucketEnd,
				mean: bucket.mean,
				index: i + 1,
				indexHwm,
			};
			subscription.ws.send(JSON.stringify(msg));
		}
	}

	/**
	 * Fill gaps in metrics buckets with null values
	 */
	private fillMetricsBuckets(
		stored: Array<{ bucketStart: number; bucketEnd: number; mean: number | null }>,
		provider: string,
		target: string,
		check: string,
		rangeStart: number,
		count: number,
		durationMs: number,
	) {
		const lookup = new Map<number, { bucketStart: number; bucketEnd: number; mean: number | null }>();

		for (const bucket of stored) {
			lookup.set(bucket.bucketStart, bucket);
		}

		const result: Array<{ bucketStart: number; bucketEnd: number; mean: number | null }> = [];

		for (let i = 0; i < count; i++) {
			const bucketStart = rangeStart + i * durationMs;
			const bucketEnd = bucketStart + durationMs;
			const existing = lookup.get(bucketStart);

			if (existing) {
				result.push(existing);
			} else {
				result.push({ bucketStart, bucketEnd, mean: null });
			}
		}

		return result;
	}

	/**
	 * Send initial historical data for a subscription
	 */
	private async sendInitialData(
		subscription: StateSubscription,
		req: StateSubscriptionRequest,
	): Promise<void> {
		const { start, end } = req;
		const endTime = end ?? Date.now();

		// Calculate bucket configuration
		const config: BucketConfig = {
			count: Math.ceil((endTime - start) / req.bucketDurationMs),
			durationMs: req.bucketDurationMs,
		};

		// Fetch stored data
		const storedBuckets = await this.bucketStore.getBuckets(start, endTime);
		const storedEvents = await this.eventStore.getEventsInRange(start, endTime);

		// Fill gaps in buckets
		const providerBuckets = this.fillProviderBuckets(storedBuckets.providers, start, config);
		const targetBuckets = this.fillTargetBuckets(storedBuckets.targets, start, config);
		const checkBuckets = this.fillCheckBuckets(storedBuckets.checks, start, config);

		// Calculate progress indices
		const totalBuckets = providerBuckets.length + targetBuckets.length + checkBuckets.length;
		const baseIndex =
			this.bucketPublishers.provider.getIndex() +
			this.bucketPublishers.target.getIndex() +
			this.bucketPublishers.check.getIndex();
		const indexHwm = baseIndex + totalBuckets;
		let currentIndex = baseIndex;

		// Send provider buckets
		for (const bucket of providerBuckets) {
			currentIndex++;
			const msg: ProviderBucketMessage = {
				type: "provider_bucket",
				subscriptionId: subscription.id,
				...bucket,
				index: currentIndex,
				indexHwm,
			};
			subscription.ws.send(JSON.stringify(msg));
		}

		// Send target buckets
		for (const bucket of targetBuckets) {
			currentIndex++;
			const msg: TargetBucketMessage = {
				type: "target_bucket",
				subscriptionId: subscription.id,
				...bucket,
				index: currentIndex,
				indexHwm,
			};
			subscription.ws.send(JSON.stringify(msg));
		}

		// Send check buckets
		for (const bucket of checkBuckets) {
			currentIndex++;
			const msg: CheckBucketMessage = {
				type: "check_bucket",
				subscriptionId: subscription.id,
				...bucket,
				index: currentIndex,
				indexHwm,
			};
			subscription.ws.send(JSON.stringify(msg));
		}

		// Send events
		for (const event of storedEvents.providers) {
			const msg: ProviderEventMessage = {
				type: "provider_event",
				subscriptionId: subscription.id,
				...event,
			};
			subscription.ws.send(JSON.stringify(msg));
		}

		for (const event of storedEvents.targets) {
			const msg: TargetEventMessage = {
				type: "target_event",
				subscriptionId: subscription.id,
				...event,
			};
			subscription.ws.send(JSON.stringify(msg));
		}

		for (const event of storedEvents.checks) {
			const msg: CheckEventMessage = {
				type: "check_event",
				subscriptionId: subscription.id,
				...event,
			};
			subscription.ws.send(JSON.stringify(msg));
		}
	}

	/**
	 * Subscribe to real-time publisher updates for a state subscription
	 */
	private subscribeToRealTimeUpdates(subscription: StateSubscription): void {
		// Subscribe to provider bucket updates
		const unsubProvider = this.bucketPublishers.provider.subscribe((bucketMsg) => {
			if (!subscription.isInRange(bucketMsg.bucketStart)) {
				return;
			}

			const msg: ProviderBucketMessage = {
				type: "provider_bucket",
				subscriptionId: subscription.id,
				...bucketMsg,
			};
			subscription.ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubProvider);

		// Subscribe to target bucket updates
		const unsubTarget = this.bucketPublishers.target.subscribe((bucketMsg) => {
			if (!subscription.isInRange(bucketMsg.bucketStart)) {
				return;
			}

			const msg: TargetBucketMessage = {
				type: "target_bucket",
				subscriptionId: subscription.id,
				...bucketMsg,
			};
			subscription.ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubTarget);

		// Subscribe to check bucket updates
		const unsubCheck = this.bucketPublishers.check.subscribe((bucketMsg) => {
			if (!subscription.isInRange(bucketMsg.bucketStart)) {
				return;
			}

			const msg: CheckBucketMessage = {
				type: "check_bucket",
				subscriptionId: subscription.id,
				...bucketMsg,
			};
			subscription.ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubCheck);

		// Subscribe to provider event updates
		const unsubProviderEvent = this.eventPublishers.provider.subscribe((event) => {
			if (!subscription.isInRange(event.startTime)) {
				return;
			}

			const msg: ProviderEventMessage = {
				type: "provider_event",
				subscriptionId: subscription.id,
				...event,
			};
			subscription.ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubProviderEvent);

		// Subscribe to target event updates
		const unsubTargetEvent = this.eventPublishers.target.subscribe((event) => {
			if (!subscription.isInRange(event.startTime)) {
				return;
			}

			const msg: TargetEventMessage = {
				type: "target_event",
				subscriptionId: subscription.id,
				...event,
			};
			subscription.ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubTargetEvent);

		// Subscribe to check event updates
		const unsubCheckEvent = this.eventPublishers.check.subscribe((event) => {
			if (!subscription.isInRange(event.startTime)) {
				return;
			}

			const msg: CheckEventMessage = {
				type: "check_event",
				subscriptionId: subscription.id,
				...event,
			};
			subscription.ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubCheckEvent);
	}

	/**
	 * Handle event detail subscription requests
	 */
	private async handleEventSubscription(
		ws: ServerWebSocket<WebSocketData>,
		req: EventSubscriptionRequest,
	): Promise<void> {
		const subscription = new EventDetailSubscription(req.id, ws, req.eventId, req.eventLevel);
		this.subscriptionManager.add(subscription);

		ws.send(JSON.stringify({ type: "subscription_ack", id: req.id }));

		// Send event info
		const events = await this.eventStore.getEventsInRange(0, Date.now() + 86400000);
		const allEvents = [...events.providers, ...events.targets, ...events.checks];
		const event = allEvents.find((e) => e.id === req.eventId);

		if (event) {
			const msg: EventInfoMessage = {
				type: "event_info",
				subscriptionId: subscription.id,
				title: event.title,
				code: event.code,
				startTime: event.startTime,
				endTime: event.endTime,
			};
			ws.send(JSON.stringify(msg));
		}

		// Send historical outcomes
		const outcomes = await this.outcomeStore.getOutcomesForEvent(req.eventId, req.eventLevel);
		for (const outcome of outcomes) {
			const msg: EventOutcomeMessage = {
				type: "event_outcome",
				subscriptionId: subscription.id,
				id: outcome.id,
				time: outcome.time,
				error: outcome.error,
				violation: outcome.violation,
			};
			ws.send(JSON.stringify(msg));
		}

		// Subscribe to real-time event updates (for endTime changes)
		const eventPublisher = req.eventLevel === "provider"
			? this.eventPublishers.provider
			: req.eventLevel === "target"
				? this.eventPublishers.target
				: this.eventPublishers.check;

		const unsubEvent = eventPublisher.subscribe((event) => {
			if (event.id !== req.eventId) return;
			const msg: EventInfoMessage = {
				type: "event_info",
				subscriptionId: subscription.id,
				title: event.title,
				code: event.code,
				startTime: event.startTime,
				endTime: event.endTime,
			};
			ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubEvent);

		// Subscribe to new outcomes for this event
		const unsubOutcome = this.outcomePublisher.subscribe((outcome) => {
			if (outcome.eventId !== req.eventId) return;
			const msg: EventOutcomeMessage = {
				type: "event_outcome",
				subscriptionId: subscription.id,
				id: outcome.id,
				time: outcome.time,
				error: outcome.error,
				violation: outcome.violation,
			};
			ws.send(JSON.stringify(msg));
		});
		subscription.addUnsubscriber(unsubOutcome);
	}

	/**
	 * Handle unsubscribe requests
	 */
	private handleUnsubscribe(ws: ServerWebSocket<WebSocketData>, req: UnsubscribeRequest): void {
		this.subscriptionManager.remove(req.id);
	}

	/**
	 * Handle WebSocket disconnection
	 */
	handleDisconnect(ws: ServerWebSocket<WebSocketData>): void {
		this.subscriptionManager.removeAllForWebSocket(ws);
	}

	/**
	 * Send error message to client
	 */
	private sendError(ws: ServerWebSocket<WebSocketData>, subscriptionId: string | undefined, error: string): void {
		if (subscriptionId) {
			ws.send(JSON.stringify({ type: "subscription_error", id: subscriptionId, error }));
		} else {
			ws.send(JSON.stringify({ type: "error", error }));
		}
	}

	// Helper methods for filling buckets (same logic as before)

	private fillProviderBuckets(
		stored: Array<{ provider: string; bucketStart: number; bucketEnd: number; status: string | null }>,
		rangeStart: number,
		config: BucketConfig,
	) {
		const lookup = new Map<string, (typeof stored)[0]>();
		const providers = new Set<string>();

		for (const bucket of stored) {
			providers.add(bucket.provider);
			lookup.set(`${bucket.provider}:${bucket.bucketStart}`, bucket);
		}

		const result: typeof stored = [];

		for (const provider of providers) {
			for (let i = 0; i < config.count; i++) {
				const bucketStart = rangeStart + i * config.durationMs;
				const bucketEnd = bucketStart + config.durationMs;
				const existing = lookup.get(`${provider}:${bucketStart}`);

				if (existing) {
					result.push(existing);
				} else {
					result.push({ provider, bucketStart, bucketEnd, status: null });
				}
			}
		}

		return result;
	}

	private fillTargetBuckets(
		stored: Array<{
			provider: string;
			target: string;
			bucketStart: number;
			bucketEnd: number;
			status: string | null;
		}>,
		rangeStart: number,
		config: BucketConfig,
	) {
		const lookup = new Map<string, (typeof stored)[0]>();
		const entities = new Set<string>();

		for (const bucket of stored) {
			const key = `${bucket.provider}/${bucket.target}`;
			entities.add(key);
			lookup.set(`${key}:${bucket.bucketStart}`, bucket);
		}

		const result: typeof stored = [];

		for (const entity of entities) {
			const [provider, target] = entity.split("/") as [string, string];
			for (let i = 0; i < config.count; i++) {
				const bucketStart = rangeStart + i * config.durationMs;
				const bucketEnd = bucketStart + config.durationMs;
				const existing = lookup.get(`${entity}:${bucketStart}`);

				if (existing) {
					result.push(existing);
				} else {
					result.push({ provider, target, bucketStart, bucketEnd, status: null });
				}
			}
		}

		return result;
	}

	private fillCheckBuckets(
		stored: Array<{
			provider: string;
			target: string;
			check: string;
			bucketStart: number;
			bucketEnd: number;
			status: string | null;
		}>,
		rangeStart: number,
		config: BucketConfig,
	) {
		const lookup = new Map<string, (typeof stored)[0]>();
		const entities = new Set<string>();

		for (const bucket of stored) {
			const key = `${bucket.provider}/${bucket.target}/${bucket.check}`;
			entities.add(key);
			lookup.set(`${key}:${bucket.bucketStart}`, bucket);
		}

		const result: typeof stored = [];

		for (const entity of entities) {
			const [provider, target, check] = entity.split("/") as [string, string, string];
			for (let i = 0; i < config.count; i++) {
				const bucketStart = rangeStart + i * config.durationMs;
				const bucketEnd = bucketStart + config.durationMs;
				const existing = lookup.get(`${entity}:${bucketStart}`);

				if (existing) {
					result.push(existing);
				} else {
					result.push({ provider, target, check, bucketStart, bucketEnd, status: null });
				}
			}
		}

		return result;
	}
}
