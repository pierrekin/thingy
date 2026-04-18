import type { AgentInstance } from "../types";

type Props = {
  instance: AgentInstance;
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AgentInstanceRow({ instance }: Props) {
  const uptime = formatDuration(Date.now() - instance.connectedAt.getTime());

  return (
    <div className="flex items-center gap-3 py-1 text-xs text-warm-grey font-mono">
      <span className="text-bone">{instance.instanceId}</span>
      <span
        className={
          instance.role === "leader" ? "text-green-400" : "text-warm-grey"
        }
      >
        {instance.role}
      </span>
      <span>up {uptime}</span>
    </div>
  );
}
