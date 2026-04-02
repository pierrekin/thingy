import type { SlotStatus } from "../types";

const statusDotColors: Record<string, string> = {
	green: "bg-green-500",
	red: "bg-red-500",
	grey: "bg-gray-300",
	null: "bg-gray-200",
};

export function StatusDot({ status }: { status: SlotStatus }) {
	return (
		<div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[status ?? "null"]}`} />
	);
}
