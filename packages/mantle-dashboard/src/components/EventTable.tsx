import { useState } from "react";
import { useWebSocketContext } from "../context/WebSocketContext";
import type { Event } from "../types";
import { EventDetailModal } from "./EventDetailModal";

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function EventRow({ event, onClick }: { event: Event; onClick: () => void }) {
  const isOngoing = event.endTime === null;
  const timeRange = isOngoing
    ? `${formatTime(event.startTime)} -`
    : `${formatTime(event.startTime)} - ${formatTime(event.endTime!)}`;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 py-2 px-3 text-left border-b border-surface last:border-b-0 hover:bg-charcoal"
      onClick={onClick}
    >
      <span className={isOngoing ? "text-critical" : "text-warm-grey"}>
        {isOngoing ? "○" : "●"}
      </span>
      <span className="text-warm-grey text-sm font-mono whitespace-nowrap shrink-0">
        {timeRange}
      </span>
      <span className="text-mist text-sm truncate">{event.title}</span>
    </button>
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
      <div className="bg-charcoal-mid border border-surface rounded-lg overflow-hidden">
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
