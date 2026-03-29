import { useState } from "react";
import type { Target } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";
import { CheckRow } from "./CheckRow";
import { useWebSocketContext } from "../context/WebSocketContext";

type Props = {
	target: Target;
};

export function TargetSection({ target }: Props) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { send, status } = useWebSocketContext();

	const hasTargetEvents = target.events.length > 0;

	return (
		<div>
			{/* Target header - white background */}
			<div className="bg-white">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full text-left px-4 py-2 flex items-center gap-2"
				>
					<span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
					<span className="text-sm font-medium text-gray-900">{target.name}</span>
				</button>
				<StatusBar slots={target.statusSlots} />
			</div>

			{/* Expanded content */}
			{isExpanded && (
				<>
					{/* Target events */}
					{hasTargetEvents && (
						<div className="bg-white px-4 pb-2">
							<EventTable events={target.events} />
						</div>
					)}

					{/* Checks with metrics */}
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
