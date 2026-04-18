import type { MantleClient } from "@mantle-team/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventSubscription } from "../hooks/useEventSubscription";
import { type DataStoreState, useDataStore } from "../subscriptions/data-store";
import type { Event } from "../types";
import type { ConnectionStatus } from "../ws-store";

type Props = {
  event: Event;
  eventLevel: "provider" | "target" | "check";
  client: MantleClient | null;
  connectionStatus: ConnectionStatus;
  onClose: () => void;
};

const EMPTY_OUTCOMES: Array<{
  id: number;
  time: number;
  error: string | null;
  violation: string | null;
}> = [];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function EventDetailModal({
  event,
  eventLevel,
  client,
  connectionStatus,
  onClose,
}: Props) {
  const params = useMemo(
    () => ({
      eventId: event.id,
      eventLevel,
    }),
    [event.id, eventLevel],
  );

  const subscriptionId = useEventSubscription(params, client, connectionStatus);

  const selectInfo = useCallback(
    (state: DataStoreState) => state.eventInfo.get(subscriptionId),
    [subscriptionId],
  );
  const selectOutcomes = useCallback(
    (state: DataStoreState) => state.eventOutcomes.get(subscriptionId),
    [subscriptionId],
  );
  const info = useDataStore(selectInfo);
  const outcomes = useDataStore(selectOutcomes) ?? EMPTY_OUTCOMES;

  const [currentIndex, setCurrentIndex] = useState(0);
  const total = outcomes.length;
  const current = outcomes[currentIndex];

  const title = info?.title ?? event.title;
  const endTime = info?.endTime ?? event.endTime;

  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="bg-charcoal-mid rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col backdrop:bg-charcoal/60"
    >
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-bone">{title}</h2>
            <div className="text-sm text-warm-grey mt-1">
              {formatTime(event.startTime)} -
              {endTime === null ? (
                <span className="text-critical ml-1">ongoing</span>
              ) : (
                <span className="ml-1">{formatTime(new Date(endTime))}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-warm-grey hover:text-mist text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Outcome viewer */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {total === 0 ? (
            <div className="text-sm text-warm-grey">
              No outcomes recorded yet.
            </div>
          ) : current ? (
            <div>
              <div className="text-xs text-warm-grey mb-2">
                {formatTime(new Date(current.time))}
              </div>
              <pre className="text-sm text-mist bg-charcoal rounded p-4 overflow-auto whitespace-pre-wrap break-words max-h-[50vh] font-mono">
                {current.error ?? current.violation ?? "No detail"}
              </pre>
            </div>
          ) : null}
        </div>

        {/* Pagination */}
        {total > 1 && (
          <div className="px-6 py-3 border-t border-surface flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-3 py-1 text-sm rounded bg-surface hover:bg-warm-grey/20 text-mist disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-sm text-warm-grey">
              {currentIndex + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex(Math.min(total - 1, currentIndex + 1))
              }
              disabled={currentIndex === total - 1}
              className="px-3 py-1 text-sm rounded bg-surface hover:bg-warm-grey/20 text-mist disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
