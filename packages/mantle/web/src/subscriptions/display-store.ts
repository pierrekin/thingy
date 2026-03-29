import type { Hub, Provider, Target, Check, Event, StatusSlot } from "../types";
import { dataStore, type SubscriptionDataStore } from "./data-store";
import type { StateSubscriptionParams } from "./types";

/**
 * DisplayStore queries the raw data store and applies display logic.
 * This is Layer 2: filtered/windowed data for rendering.
 *
 * Separates concerns: data storage vs. presentation logic.
 */
export class DisplayStore {
	constructor(
		private dataStore: SubscriptionDataStore,
		private subscriptionParams: Map<string, StateSubscriptionParams>,
	) {}

	/**
	 * Get the visible time window for a subscription.
	 * In live mode, calculates the current rolling window.
	 * In historical mode, returns the fixed range.
	 */
	private getVisibleTimeWindow(subscriptionId: string): { start: number; end: number } | null {
		const params = this.subscriptionParams.get(subscriptionId);
		if (!params) {
			return null;
		}

		if (params.end === null) {
			// Live mode: calculate current window
			const now = Date.now();
			// Calculate how many buckets to show based on original start time
			const duration = now - params.start;
			const bucketCount = Math.ceil(duration / params.bucketDurationMs);
			const windowStart = now - bucketCount * params.bucketDurationMs;
			return { start: windowStart, end: now };
		} else {
			// Historical mode: use fixed range
			return { start: params.start, end: params.end };
		}
	}

	/**
	 * Filter buckets to only those in the visible window
	 */
	private filterBucketsInWindow<T extends { bucketStart: number }>(buckets: T[], window: { start: number; end: number }): T[] {
		return buckets.filter((b) => b.bucketStart >= window.start && b.bucketStart < window.end);
	}

	/**
	 * Convert bucket map to sorted status slots
	 */
	private bucketsToSlots(bucketMap: Map<number, { bucketStart: number; bucketEnd: number; status: "green" | "red" | "grey" | null }>): StatusSlot[] {
		const entries = Array.from(bucketMap.values());
		entries.sort((a, b) => a.bucketStart - b.bucketStart);
		return entries.map((b) => ({
			start: b.bucketStart,
			end: b.bucketEnd,
			status: b.status,
		}));
	}

	/**
	 * Convert raw event data to display Event type
	 */
	private toEvent(e: {
		id: number;
		code: string;
		message: string;
		startTime: number;
		endTime: number | null;
	}): Event {
		return {
			id: e.id,
			code: e.code,
			message: e.message,
			startTime: new Date(e.startTime),
			endTime: e.endTime ? new Date(e.endTime) : null,
		};
	}

	/**
	 * Derive the Hub view from subscription data.
	 * This performs the same transformation as the old deriveHub function,
	 * but applies windowing based on subscription parameters.
	 */
	deriveHub(subscriptionId: string): Hub {
		const window = this.getVisibleTimeWindow(subscriptionId);
		if (!window) {
			return { name: "Hub", providers: [], channels: [], targets: [] };
		}

		// Get all data for this subscription
		const providerBucketsMap = this.dataStore.getProviderBuckets(subscriptionId);
		const targetBucketsMap = this.dataStore.getTargetBuckets(subscriptionId);
		const checkBucketsMap = this.dataStore.getCheckBuckets(subscriptionId);
		const providerEventsMap = this.dataStore.getProviderEvents(subscriptionId);
		const targetEventsMap = this.dataStore.getTargetEvents(subscriptionId);
		const checkEventsMap = this.dataStore.getCheckEvents(subscriptionId);

		// Collect all unique provider names
		const providerNames = new Set<string>();
		for (const provider of providerBucketsMap.keys()) {
			providerNames.add(provider);
		}

		// Collect all targets
		const targetKeys = new Map<string, { provider: string; target: string }>();
		for (const key of targetBucketsMap.keys()) {
			const [provider, target] = key.split("/") as [string, string];
			providerNames.add(provider);
			targetKeys.set(key, { provider, target });
		}

		// Collect all checks
		const checkKeys = new Map<string, { provider: string; target: string; check: string }>();
		for (const key of checkBucketsMap.keys()) {
			const [provider, target, check] = key.split("/") as [string, string, string];
			providerNames.add(provider);
			const targetKey = `${provider}/${target}`;
			if (!targetKeys.has(targetKey)) {
				targetKeys.set(targetKey, { provider, target });
			}
			checkKeys.set(key, { provider, target, check });
		}

		// Build providers
		const providers: Provider[] = Array.from(providerNames)
			.sort()
			.map((name) => {
				const events: Event[] = [];
				for (const e of providerEventsMap.values()) {
					if (e.provider === name) {
						events.push(this.toEvent(e));
					}
				}
				events.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

				const bucketMap = providerBucketsMap.get(name);
				const slots = bucketMap ? this.bucketsToSlots(bucketMap) : [];
				const visibleSlots = this.filterBucketsInWindow(slots, window);

				return {
					name,
					statusSlots: visibleSlots,
					events,
				};
			});

		// Build targets with checks
		const targetsByProvider = new Map<string, Target[]>();
		for (const [key, { provider, target }] of targetKeys) {
			// Get checks for this target
			const checksForTarget: Check[] = [];
			for (const [checkKey, checkInfo] of checkKeys) {
				if (checkInfo.provider === provider && checkInfo.target === target) {
					const checkEvents: Event[] = [];
					for (const e of checkEventsMap.values()) {
						if (e.provider === provider && e.target === target && e.check === checkInfo.check) {
							checkEvents.push(this.toEvent(e));
						}
					}
					checkEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

					const bucketMap = checkBucketsMap.get(checkKey);
					const slots = bucketMap ? this.bucketsToSlots(bucketMap) : [];
					const visibleSlots = this.filterBucketsInWindow(slots, window);

					checksForTarget.push({
						name: checkInfo.check,
						statusSlots: visibleSlots,
						events: checkEvents,
					});
				}
			}
			checksForTarget.sort((a, b) => a.name.localeCompare(b.name));

			// Get events for this target
			const targetEvents: Event[] = [];
			for (const e of targetEventsMap.values()) {
				if (e.provider === provider && e.target === target) {
					targetEvents.push(this.toEvent(e));
				}
			}
			targetEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

			const bucketMap = targetBucketsMap.get(key);
			const slots = bucketMap ? this.bucketsToSlots(bucketMap) : [];
			const visibleSlots = this.filterBucketsInWindow(slots, window);

			const targetObj: Target = {
				name: target,
				provider,
				statusSlots: visibleSlots,
				events: targetEvents,
				checks: checksForTarget,
			};

			const existing = targetsByProvider.get(provider) ?? [];
			existing.push(targetObj);
			targetsByProvider.set(provider, existing);
		}

		const targets: Target[] = [];
		for (const providerTargets of targetsByProvider.values()) {
			providerTargets.sort((a, b) => a.name.localeCompare(b.name));
			targets.push(...providerTargets);
		}

		return {
			name: "Hub",
			providers,
			channels: [],
			targets,
		};
	}

	/**
	 * Get loading progress for a subscription
	 */
	getLoadingProgress(subscriptionId: string): number {
		const progress = this.dataStore.getProgress(subscriptionId);
		if (progress.indexHwm === 0) return 0;
		return Math.min(100, (progress.index / progress.indexHwm) * 100);
	}

	/**
	 * Check if a subscription is still loading
	 */
	isLoading(subscriptionId: string): boolean {
		const progress = this.dataStore.getProgress(subscriptionId);
		const threshold = 5;
		return progress.indexHwm - progress.index > threshold;
	}
}

// Global singleton instance
// We pass the dataStore and an empty params map initially
// The params map will be populated by the subscription manager
const subscriptionParams = new Map<string, StateSubscriptionParams>();
export const displayStore = new DisplayStore(dataStore, subscriptionParams);
export { subscriptionParams };
