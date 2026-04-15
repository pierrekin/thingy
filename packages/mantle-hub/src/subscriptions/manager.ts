import type { MantleSocket } from "../mantle-socket.ts";
import type { Subscription } from "./base.ts";

/**
 * SubscriptionManager tracks all active subscriptions and manages their lifecycle.
 * Each WebSocket connection can have multiple subscriptions (state, metrics, etc).
 */
export class SubscriptionManager {
	private subscriptions = new Map<string, Subscription>();
	private subscriptionsByWs = new Map<MantleSocket<unknown>, Set<string>>();

	/**
	 * Register a new subscription
	 */
	add(subscription: Subscription): void {
		this.subscriptions.set(subscription.id, subscription);

		// Track which subscriptions belong to which WebSocket
		const wsSubscriptions = this.subscriptionsByWs.get(subscription.ws) ?? new Set<string>();
		wsSubscriptions.add(subscription.id);
		this.subscriptionsByWs.set(subscription.ws, wsSubscriptions);
	}

	/**
	 * Get a subscription by ID
	 */
	get(id: string): Subscription | undefined {
		return this.subscriptions.get(id);
	}

	/**
	 * Remove a subscription and clean it up
	 */
	remove(id: string): void {
		const subscription = this.subscriptions.get(id);
		if (!subscription) {
			return;
		}

		// Clean up the subscription
		subscription.cleanup();

		// Remove from maps
		this.subscriptions.delete(id);
		const wsSubscriptions = this.subscriptionsByWs.get(subscription.ws);
		if (wsSubscriptions) {
			wsSubscriptions.delete(id);
			if (wsSubscriptions.size === 0) {
				this.subscriptionsByWs.delete(subscription.ws);
			}
		}
	}

	/**
	 * Remove all subscriptions for a WebSocket (e.g., when client disconnects)
	 */
	removeAllForWebSocket(ws: MantleSocket<unknown>): void {
		const wsSubscriptions = this.subscriptionsByWs.get(ws);
		if (!wsSubscriptions) {
			return;
		}

		// Remove each subscription
		for (const id of wsSubscriptions) {
			const subscription = this.subscriptions.get(id);
			if (subscription) {
				subscription.cleanup();
				this.subscriptions.delete(id);
			}
		}

		this.subscriptionsByWs.delete(ws);
	}

	/**
	 * Get all subscription IDs for a WebSocket
	 */
	getSubscriptionIdsForWebSocket(ws: MantleSocket<unknown>): string[] {
		const wsSubscriptions = this.subscriptionsByWs.get(ws);
		return wsSubscriptions ? Array.from(wsSubscriptions) : [];
	}

	/**
	 * Get count of active subscriptions
	 */
	size(): number {
		return this.subscriptions.size;
	}
}
