import type { StateSubscriptionParams, SubscriptionMetadata } from "./types";
import { subscriptionParams } from "./display-store";

type SubscriptionChangeListener = (subscriptions: Map<string, SubscriptionMetadata>) => void;

/**
 * Client-side subscription manager.
 * Tracks active subscriptions and their metadata.
 */
export class ClientSubscriptionManager {
	private subscriptions = new Map<string, SubscriptionMetadata>();
	private listeners = new Set<SubscriptionChangeListener>();

	/**
	 * Generate a unique subscription ID
	 */
	generateId(): string {
		return `sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	}

	/**
	 * Create a new state subscription (pending state)
	 */
	createStateSubscription(params: StateSubscriptionParams): string {
		const id = this.generateId();
		const metadata: SubscriptionMetadata = {
			id,
			type: "state",
			params,
			status: "pending",
		};

		this.subscriptions.set(id, metadata);
		subscriptionParams.set(id, params); // Update display store params
		this.notifyListeners();

		return id;
	}

	/**
	 * Mark a subscription as active (after receiving ack)
	 */
	markActive(id: string): void {
		const sub = this.subscriptions.get(id);
		if (sub) {
			sub.status = "active";
			this.subscriptions.set(id, sub);
			this.notifyListeners();
		}
	}

	/**
	 * Mark a subscription as errored
	 */
	markError(id: string, error: string): void {
		const sub = this.subscriptions.get(id);
		if (sub) {
			sub.status = "error";
			sub.error = error;
			this.subscriptions.set(id, sub);
			this.notifyListeners();
		}
	}

	/**
	 * Remove a subscription
	 */
	remove(id: string): void {
		this.subscriptions.delete(id);
		subscriptionParams.delete(id);
		this.notifyListeners();
	}

	/**
	 * Get a subscription by ID
	 */
	get(id: string): SubscriptionMetadata | undefined {
		return this.subscriptions.get(id);
	}

	/**
	 * Get all subscriptions
	 */
	getAll(): Map<string, SubscriptionMetadata> {
		return new Map(this.subscriptions);
	}

	/**
	 * Subscribe to subscription changes
	 */
	subscribe(listener: SubscriptionChangeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Notify listeners of changes
	 */
	private notifyListeners(): void {
		const subscriptions = this.getAll();
		for (const listener of this.listeners) {
			listener(subscriptions);
		}
	}

	/**
	 * Clear all subscriptions
	 */
	clear(): void {
		this.subscriptions.clear();
		subscriptionParams.clear();
		this.notifyListeners();
	}
}

// Global singleton instance
export const subscriptionManager = new ClientSubscriptionManager();
