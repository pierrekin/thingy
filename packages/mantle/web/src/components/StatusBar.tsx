import type { StatusSlot } from "../mock-data";

const statusColors = {
	green: "bg-green-500",
	red: "bg-red-500",
	grey: "bg-gray-300",
	null: "bg-transparent border border-gray-200",
};

export function StatusBar({ slots }: { slots: StatusSlot[] }) {
	return (
		<div className="flex gap-0.5 px-4 py-1">
			{slots.map((slot, i) => (
				<div
					key={i}
					className={`h-3 flex-1 rounded-sm ${statusColors[slot.status ?? "null"]}`}
					title={`${new Date(slot.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} - ${new Date(slot.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`}
				/>
			))}
		</div>
	);
}
