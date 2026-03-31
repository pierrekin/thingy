import type { Event, StatusSlot } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";

type Props = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
	eventLevel: "provider" | "target" | "check";
};

export function EntitySection({ name, statusSlots, events, eventLevel }: Props) {
	return (
		<div className="bg-white">
			<div className="px-4 py-2">
				<h3 className="text-sm font-medium text-gray-900">{name}</h3>
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
