import type { MantleSocket } from "./mantle-socket.ts";
import type { AgentInstanceInfo, AgentInstancesPublisher } from "./pubsub.ts";

type AgentData = { audience: "agent"; agentId?: string; instanceId?: string };

export type AgentRole = "leader" | "standby";

export type AgentInstance = {
  instanceId: string;
  agentId: string;
  socket: MantleSocket<AgentData>;
  connectedAt: number;
  role: AgentRole;
};

let counter = 0;

function generateInstanceId(): string {
  return `${Date.now().toString(36)}-${(counter++).toString(36)}`;
}

function toInfo(i: AgentInstance): AgentInstanceInfo {
  return { instanceId: i.instanceId, role: i.role, connectedAt: i.connectedAt };
}

export class AgentRegistry {
  /** agentId → instances, ordered newest-first */
  private agents = new Map<string, AgentInstance[]>();
  /** instanceId → instance (for fast lookup on disconnect) */
  private byInstanceId = new Map<string, AgentInstance>();

  constructor(private publisher: AgentInstancesPublisher) {}

  add(agentId: string, socket: MantleSocket<AgentData>): AgentInstance {
    const instanceId = generateInstanceId();
    const instances = this.agents.get(agentId) ?? [];

    const isLeader = instances.length === 0;
    const instance: AgentInstance = {
      instanceId,
      agentId,
      socket,
      connectedAt: Date.now(),
      role: isLeader ? "leader" : "standby",
    };

    // Insert at front (newest-first)
    instances.unshift(instance);
    this.agents.set(agentId, instances);
    this.byInstanceId.set(instanceId, instance);

    // Tag the socket so we can find the instance on disconnect
    socket.data.instanceId = instanceId;

    this.publishFor(agentId);
    return instance;
  }

  /** Remove an instance. Returns the promoted instance if a leader was removed, or null. */
  remove(instanceId: string): AgentInstance | null {
    const instance = this.byInstanceId.get(instanceId);
    if (!instance) return null;

    this.byInstanceId.delete(instanceId);

    const instances = this.agents.get(instance.agentId);
    if (!instances) {
      this.publisher.publish({ agent: instance.agentId, instances: [] });
      return null;
    }

    const idx = instances.indexOf(instance);
    if (idx !== -1) instances.splice(idx, 1);

    if (instances.length === 0) {
      this.agents.delete(instance.agentId);
      this.publisher.publish({ agent: instance.agentId, instances: [] });
      return null;
    }

    // If the removed instance was the leader, promote the newest standby
    const [next] = instances;
    if (instance.role === "leader" && next) {
      next.role = "leader";
      this.publishFor(instance.agentId);
      return next;
    }

    this.publishFor(instance.agentId);
    return null;
  }

  get(instanceId: string): AgentInstance | undefined {
    return this.byInstanceId.get(instanceId);
  }

  getInstances(agentId: string): AgentInstance[] {
    return this.agents.get(agentId) ?? [];
  }

  getLeader(agentId: string): AgentInstance | undefined {
    return this.getInstances(agentId).find((i) => i.role === "leader");
  }

  /** Snapshot of all agents and their instances, for new subscribers. */
  snapshot(): Array<{ agent: string; instances: AgentInstanceInfo[] }> {
    return Array.from(this.agents.entries()).map(([agent, list]) => ({
      agent,
      instances: list.map(toInfo),
    }));
  }

  private publishFor(agentId: string): void {
    const list = this.agents.get(agentId) ?? [];
    this.publisher.publish({ agent: agentId, instances: list.map(toInfo) });
  }
}
