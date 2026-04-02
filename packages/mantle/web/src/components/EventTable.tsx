import { useState } from "react";
import type { Event } from "../types";
import { useWebSocketContext } from "../context/WebSocketContext";
import { EventDetailModal } from "./EventDetailModal";

function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function EventRow({ event, onClick }: { event: Event; onClick: () => void }) {
	const isOngoing = event.endTime === null;
	const timeRange = isOngoing
		? `${formatTime(event.startTime)} -`
		: `${formatTime(event.startTime)} - ${formatTime(event.endTime!)}`;

	return (
		<div
			className="flex items-center gap-3 py-2 px-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50"
			onClick={onClick}
		>
			<span className={isOngoing ? "text-red-500" : "text-gray-400"}>
				{isOngoing ? "○" : "●"}
			</span>
			<span className="text-gray-500 text-sm font-mono whitespace-nowrap shrink-0">{timeRange}</span>
			<span className="text-gray-700 text-sm truncate">{event.title}</span>
		</div>
	);
}

type Props = {
	events: Event[];
	eventLevel: "provider" | "target" | "check";
};

export function EventTable({ events, eventLevel }: Props) {
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const { client, status } = useWebSocketContext();

	if (events.length === 0) {
		return null;
	}

	return (
		<>
			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				{events.map((event) => (
					<EventRow
						key={event.id}
						event={event}
						onClick={() => setSelectedEvent(event)}
					/>
				))}
			</div>
			{selectedEvent && (
				<EventDetailModal
					event={selectedEvent}
					eventLevel={eventLevel}
					client={client}
					connectionStatus={status}
					onClose={() => setSelectedEvent(null)}
				/>
			)}
		</>
	);
}
