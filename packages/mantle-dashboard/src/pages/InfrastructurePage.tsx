import type { Hub } from "../types";
import { EntitySection } from "../components/EntitySection";
import { AgentSection } from "../components/AgentSection";

type Props = {
	hub: Hub;
};

export function InfrastructurePage({ hub }: Props) {
	return (
		<main>
			{hub.providers.length > 0 && (
				<section>
					<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
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
					<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
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
					<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
						Agents
					</h2>
					{hub.agents.map((agent) => (
						<AgentSection key={agent.name} agent={agent} />
					))}
				</section>
			)}
		</main>
	);
}
