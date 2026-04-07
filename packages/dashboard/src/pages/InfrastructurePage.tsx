import type { Hub } from "../types";
import { EntitySection } from "../components/EntitySection";

type Props = {
	hub: Hub;
	onNavigateBack: () => void;
};

export function InfrastructurePage({ hub, onNavigateBack }: Props) {
	return (
		<div className="min-h-screen bg-gray-200">
			<header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
				<h1 className="text-lg font-semibold text-gray-900">{hub.name}</h1>
				<button
					onClick={onNavigateBack}
					className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
				>
					← Back
				</button>
			</header>

			<main>
				{hub.providers.length > 0 && (
					<section>
						<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
							Providers
						</h2>
						{hub.providers.map((provider) => (
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

				{hub.channels.length > 0 && (
					<section>
						<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
							Channels
						</h2>
						{hub.channels.map((channel) => (
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

				{hub.agents.length > 0 && (
					<section>
						<h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 bg-gray-200">
							Agents
						</h2>
						{hub.agents.map((agent) => (
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
			</main>
		</div>
	);
}
