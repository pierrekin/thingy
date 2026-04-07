import { useState, useMemo, useCallback } from "react";
import type { Event } from "../types";
import type { ConnectionStatus } from "../hooks/useWebSocket";
import type { MantleClient } from "mantle/src/client/index.ts";
import { useEventSubscription } from "../hooks/useEventSubscription";
import { useDataStore } from "../subscriptions/data-store";

type Props = {
	event: Event;
	eventLevel: "provider" | "target" | "check";
	client: MantleClient | null;
	connectionStatus: ConnectionStatus;
	onClose: () => void;
};

const EMPTY_OUTCOMES: Array<{ id: number; time: number; error: string | null; violation: string | null }> = [];

function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function EventDetailModal({ event, eventLevel, client, connectionStatus, onClose }: Props) {
	const params = useMemo(() => ({
		eventId: event.id,
		eventLevel,
	}), [event.id, eventLevel]);

	const subscriptionId = useEventSubscription(params, client, connectionStatus);

	const selectInfo = useCallback((state: { eventInfo: Map<string, any> }) => state.eventInfo.get(subscriptionId), [subscriptionId]);
	const selectOutcomes = useCallback((state: { eventOutcomes: Map<string, any> }) => state.eventOutcomes.get(subscriptionId), [subscriptionId]);
	const info = useDataStore(selectInfo);
	const outcomes = useDataStore(selectOutcomes) ?? EMPTY_OUTCOMES;

	const [currentIndex, setCurrentIndex] = useState(0);
	const total = outcomes.length;
	const current = outcomes[currentIndex];

	const title = info?.title ?? event.title;
	const isOngoing = (info?.endTime ?? event.endTime) === null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
			<div className="absolute inset-0 bg-black/40" />
			<div
				className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-gray-900">{title}</h2>
						<div className="text-sm text-gray-500 mt-1">
							{formatTime(event.startTime)} -
							{isOngoing
								? <span className="text-red-500 ml-1">ongoing</span>
								: <span className="ml-1">{formatTime(new Date(info?.endTime ?? event.endTime!))}</span>
							}
						</div>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 text-xl leading-none"
					>
						&times;
					</button>
				</div>

				{/* Outcome viewer */}
				<div className="flex-1 overflow-auto px-6 py-4">
					{total === 0 ? (
						<div className="text-sm text-gray-400">No outcomes recorded yet.</div>
					) : current ? (
						<div>
							<div className="text-xs text-gray-500 mb-2">
								{formatTime(new Date(current.time))}
							</div>
							<pre className="text-sm text-gray-800 bg-gray-50 rounded p-4 overflow-auto whitespace-pre-wrap break-words max-h-[50vh]">
								{current.error ?? current.violation ?? "No detail"}
							</pre>
						</div>
					) : null}
				</div>

				{/* Pagination */}
				{total > 1 && (
					<div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
						<button
							onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
							disabled={currentIndex === 0}
							className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
						>
							Prev
						</button>
						<span className="text-sm text-gray-500">
							{currentIndex + 1} / {total}
						</span>
						<button
							onClick={() => setCurrentIndex(Math.min(total - 1, currentIndex + 1))}
							disabled={currentIndex === total - 1}
							className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
						>
							Next
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
