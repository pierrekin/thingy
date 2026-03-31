import { useState } from "react";
import type { Target, SlotStatus } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";
import { CheckRow } from "./CheckRow";
import { useWebSocketContext } from "../context/WebSocketContext";

type Props = {
	target: Target;
};

const statusDotColors: Record<string, string> = {
	green: "bg-green-500",
	red: "bg-red-500",
	grey: "bg-gray-300",
	null: "bg-gray-200",
};

function StatusDot({ status }: { status: SlotStatus }) {
	return (
		<div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[status ?? "null"]}`} />
	);
}

export function TargetSection({ target }: Props) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { send, status } = useWebSocketContext();

	const hasTargetEvents = target.events.length > 0;

	// Collapsed: all green, user hasn't expanded — just dot + label
	// Partial: not all green, user hasn't expanded — show status bar
	// Full: user has expanded — show checks
	const showStatusBar = isExpanded || !target.allGreen;
	const showChecks = isExpanded;

	return (
		<div>
			<div className="bg-white">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full text-left px-4 py-2 flex items-center gap-2"
				>
					<span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
					<span className="text-sm font-medium text-gray-900 flex-1">{target.name}</span>
					<StatusDot status={target.latestStatus} />
				</button>
				{showStatusBar && <StatusBar slots={target.statusSlots} />}
			</div>

			{showChecks && (
				<>
					{hasTargetEvents && (
						<div className="bg-white px-4 pb-2">
							<EventTable events={target.events} eventLevel="target" />
						</div>
					)}

					{target.checks.map((check) => (
						<CheckRow
							key={check.name}
							provider={target.provider}
							target={target.name}
							check={check}
							send={send}
							connectionStatus={status}
						/>
					))}
				</>
			)}
		</div>
	);
}
