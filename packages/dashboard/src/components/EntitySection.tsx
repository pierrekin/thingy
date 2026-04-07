import type { Event, StatusSlot, SlotStatus } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";
import { StatusDot } from "./StatusDot";

type Props = {
	name: string;
	statusSlots: StatusSlot[];
	latestStatus: SlotStatus;
	events: Event[];
	eventLevel: "provider" | "target" | "check";
};

export function EntitySection({ name, statusSlots, latestStatus, events, eventLevel }: Props) {
	return (
		<div className="bg-white">
			<div className="px-4 py-2 flex items-center gap-2">
				<h3 className="text-sm font-medium text-gray-900 flex-1">{name}</h3>
				<StatusDot status={latestStatus} />
			</div>
			<StatusBar slots={statusSlots} />
			{events.length > 0 && (
				<div className="px-4 pb-2">
					<EventTable events={events} eventLevel={eventLevel} />
				</div>
			)}
		</div>
	);
}
