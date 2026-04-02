import type { Hub } from "../types";
import { EntitySection } from "../components/EntitySection";
import { TargetSection } from "../components/TargetSection";

type Props = {
	hub: Hub;
	onNavigateToInfra: () => void;
};

export function MainPage({ hub, onNavigateToInfra }: Props) {
	const providersWithEvents = hub.providers.filter((p) => p.events.length > 0);
	const channelsWithEvents = hub.channels.filter((c) => c.events.length > 0);
	const agentsWithEvents = hub.agents.filter((a) => a.events.length > 0);

	return (
		<div className="min-h-screen bg-gray-200">
			<header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
				<h1 className="text-lg font-semibold text-gray-900">{hub.name}</h1>
				<button
					onClick={onNavigateToInfra}
					className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
				>
					Infrastructure
				</button>
			</header>

			<main>
				{providersWithEvents.length > 0 && (
					<section>
						<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
							Providers
						</h2>
						{providersWithEvents.map((provider) => (
							<EntitySection
								key={provider.name}
								name={provider.name}
								statusSlots={provider.statusSlots}
								latestStatus={provider.latestStatus}
								events={provider.events}
								eventLevel="provider"
							/>
						))}
					</section>
				)}

				{channelsWithEvents.length > 0 && (
					<section>
						<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
							Channels
						</h2>
						{channelsWithEvents.map((channel) => (
							<EntitySection
								key={channel.name}
								name={channel.name}
								statusSlots={channel.statusSlots}
								latestStatus={channel.latestStatus}
								events={channel.events}
								eventLevel="provider"
							/>
						))}
					</section>
				)}

				{agentsWithEvents.length > 0 && (
					<section>
						<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
							Agents
						</h2>
						{agentsWithEvents.map((agent) => (
							<EntitySection
								key={agent.name}
								name={agent.name}
								statusSlots={agent.statusSlots}
								latestStatus={agent.latestStatus}
								events={agent.events}
								eventLevel="provider"
							/>
						))}
					</section>
				)}

				<section>
					<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
						Targets
					</h2>
					{hub.targets.map((target) => (
						<TargetSection key={target.name} target={target} />
					))}
				</section>
			</main>
		</div>
	);
}
