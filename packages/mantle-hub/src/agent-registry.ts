import type { MantleSocket } from "./mantle-socket.ts";

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

export class AgentRegistry {
	/** agentId → instances, ordered newest-first */
	private agents = new Map<string, AgentInstance[]>();
	/** instanceId → instance (for fast lookup on disconnect) */
	private byInstanceId = new Map<string, AgentInstance>();

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

		return instance;
	}

	/** Remove an instance. Returns the promoted instance if a leader was removed, or null. */
	remove(instanceId: string): AgentInstance | null {
		const instance = this.byInstanceId.get(instanceId);
		if (!instance) return null;

		this.byInstanceId.delete(instanceId);

		const instances = this.agents.get(instance.agentId);
		if (!instances) return null;

		const idx = instances.indexOf(instance);
		if (idx !== -1) instances.splice(idx, 1);

		if (instances.length === 0) {
			this.agents.delete(instance.agentId);
			return null;
		}

		// If the removed instance was the leader, promote the newest standby
		if (instance.role === "leader") {
			const next = instances[0]!;
			next.role = "leader";
			return next;
		}

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
}
