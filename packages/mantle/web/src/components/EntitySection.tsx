import type { Event, StatusSlot } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";

type Props = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export function EntitySection({ name, statusSlots, events }: Props) {
	return (
		<div className="bg-white">
			<div className="px-4 py-2">
				<h3 className="text-sm font-medium text-gray-900">{name}</h3>
			</div>
			<StatusBar slots={statusSlots} />
			{events.length > 0 && (
				<div className="px-4 pb-2">
					<EventTable events={events} />
				</div>
			)}
		</div>
	);
}
