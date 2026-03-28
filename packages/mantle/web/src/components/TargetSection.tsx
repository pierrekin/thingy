import { useState } from "react";
import type { Target } from "../types";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";

type Props = {
	target: Target;
};

export function TargetSection({ target }: Props) {
	const [isExpanded, setIsExpanded] = useState(false);

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

					{/* Checks */}
					{target.checks.map((check) => {
						const hasEvents = check.events.length > 0;

						return (
							<div key={check.name} className="bg-gray-100">
								<div className="px-4 py-2">
									<span className="text-sm text-gray-600">{check.name}</span>
								</div>
								<StatusBar slots={check.statusSlots} />
								{hasEvents && (
									<div className="px-4 pb-2">
										<EventTable events={check.events} />
									</div>
								)}
							</div>
						);
					})}
				</>
			)}
		</div>
	);
}
