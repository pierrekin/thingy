import type { Event } from "../types";

function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function EventRow({ event }: { event: Event }) {
	const isOngoing = event.endTime === null;
	const timeRange = isOngoing
		? `${formatTime(event.startTime)} -`
		: `${formatTime(event.startTime)} - ${formatTime(event.endTime!)}`;

	return (
		<div className="flex items-center gap-3 py-2 px-3 border-b border-gray-100 last:border-b-0">
			<span className={isOngoing ? "text-red-500" : "text-gray-400"}>
				{isOngoing ? "○" : "●"}
			</span>
			<span className="text-gray-500 text-sm font-mono whitespace-nowrap shrink-0">{timeRange}</span>
			<span className="text-gray-700 text-sm truncate">{event.message}</span>
		</div>
	);
}

export function EventTable({ events }: { events: Event[] }) {
	if (events.length === 0) {
		return null;
	}

	return (
		<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
			{events.map((event) => (
				<EventRow key={event.id} event={event} />
			))}
		</div>
	);
}
