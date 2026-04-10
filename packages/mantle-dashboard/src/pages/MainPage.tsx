import type { Hub } from "../types";
import { EntitySection } from "../components/EntitySection";
import { TargetSection } from "../components/TargetSection";

type Props = {
	hub: Hub;
};

export function MainPage({ hub }: Props) {
	const providersWithEvents = hub.providers.filter((p) => p.events.length > 0);
	const channelsWithEvents = hub.channels.filter((c) => c.events.length > 0);
	const agentsWithEvents = hub.agents.filter((a) => a.events.length > 0);

	return (
		<main>
			{providersWithEvents.length > 0 && (
				<section>
					<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
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
					<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
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
					<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
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
				<h2 className="text-xs font-semibold text-warm-grey uppercase tracking-wide px-4 py-3 bg-charcoal-mid">
					Targets
				</h2>
				{hub.targets.map((target) => (
					<TargetSection key={target.name} target={target} />
				))}
			</section>
		</main>
	);
}
