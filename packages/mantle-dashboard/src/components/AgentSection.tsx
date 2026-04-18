import { useState } from "react";
import type { Agent } from "../types";
import { AgentInstanceRow } from "./AgentInstanceRow";
import { EventTable } from "./EventTable";
import { StatusBar } from "./StatusBar";
import { StatusDot } from "./StatusDot";

type Props = {
  agent: Agent;
};

export function AgentSection({ agent }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasEvents = agent.events.length > 0;
  const hasInstances = agent.instances.length > 0;

  return (
    <div>
      <div className="bg-charcoal-mid">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left px-4 py-2 flex items-center gap-2"
        >
          <span className="text-xs text-warm-grey">
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="text-sm font-medium text-bone flex-1">
            {agent.name}
            {agent.badgeCount > 0 && (
              <span className="ml-2 text-xs text-warm-grey font-normal">
                ({agent.badgeCount})
              </span>
            )}
          </span>
          <StatusDot status={agent.latestStatus} />
        </button>
        {isExpanded && <StatusBar slots={agent.statusSlots} />}
      </div>

      {isExpanded && (
        <>
          {hasEvents && (
            <div className="bg-charcoal-mid px-4 pb-2">
              <EventTable events={agent.events} eventLevel="provider" />
            </div>
          )}

          {hasInstances && (
            <div className="bg-charcoal-mid px-4 py-2 border-t border-charcoal-dark">
              <div className="text-xs font-semibold text-warm-grey uppercase tracking-wide mb-2">
                Instances
              </div>
              {agent.instances.map((instance) => (
                <AgentInstanceRow
                  key={instance.instanceId}
                  instance={instance}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
