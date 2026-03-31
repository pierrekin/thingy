import type { Hub, Provider, Target, Check, Event, StatusSlot } from "../types";
import { useDataStore } from "./data-store";
import type { StateSubscriptionParams } from "./types";

/**
 * Get the visible time window for a subscription.
 * In live mode, calculates the current rolling window.
 * In historical mode, returns the fixed range.
 */
function getVisibleTimeWindow(params: StateSubscriptionParams): { start: number; end: number } {
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
 * Filter slots to only those in the visible window
 */
function filterSlotsInWindow(slots: StatusSlot[], window: { start: number; end: number }): StatusSlot[] {
	return slots.filter((s) => s.start >= window.start && s.start < window.end);
}

/**
 * Convert bucket map to sorted status slots
 */
function bucketsToSlots(bucketMap: Map<number, { bucketStart: number; bucketEnd: number; status: "green" | "red" | "grey" | null }>): StatusSlot[] {
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
function toEvent(e: {
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
 * This performs transformation and applies windowing based on subscription parameters.
 */
export function deriveHub(subscriptionId: string, params: StateSubscriptionParams): Hub {
	const window = getVisibleTimeWindow(params);
	const state = useDataStore.getState();

	// Get all data for this subscription
	const providerBucketsMap = state.providerBuckets.get(subscriptionId) ?? new Map();
	const targetBucketsMap = state.targetBuckets.get(subscriptionId) ?? new Map();
	const checkBucketsMap = state.checkBuckets.get(subscriptionId) ?? new Map();
	const providerEventsMap = state.providerEvents.get(subscriptionId) ?? new Map();
	const targetEventsMap = state.targetEvents.get(subscriptionId) ?? new Map();
	const checkEventsMap = state.checkEvents.get(subscriptionId) ?? new Map();

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
					events.push(toEvent(e));
				}
			}
			events.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

			const bucketMap = providerBucketsMap.get(name);
			const slots = bucketMap ? bucketsToSlots(bucketMap) : [];
			const visibleSlots = filterSlotsInWindow(slots, window);

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
						checkEvents.push(toEvent(e));
					}
				}
				checkEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

				const bucketMap = checkBucketsMap.get(checkKey);
				const slots = bucketMap ? bucketsToSlots(bucketMap) : [];
				const visibleSlots = filterSlotsInWindow(slots, window);

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
				targetEvents.push(toEvent(e));
			}
		}
		targetEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

		const bucketMap = targetBucketsMap.get(key);
		const slots = bucketMap ? bucketsToSlots(bucketMap) : [];
		const visibleSlots = filterSlotsInWindow(slots, window);

		const latestStatus = visibleSlots.length > 0
			? visibleSlots[visibleSlots.length - 1]!.status
			: null;
		const hasRedInWindow = visibleSlots.some((s) => s.status === "red");

		const targetObj: Target = {
			name: target,
			provider,
			statusSlots: visibleSlots,
			latestStatus,
			hasRedInWindow,
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
