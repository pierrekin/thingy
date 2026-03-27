import type { OutcomeStore, EventStore } from "../store/types.ts";
import type { AgentMessage } from "../protocol.ts";
import { EventTracker } from "../agent/events.ts";

export class HubService {
	private events: EventTracker;

	constructor(
		private outcomeStore: OutcomeStore,
		eventStore: EventStore,
	) {
		this.events = new EventTracker(eventStore);
	}

	async handleAgentMessage(msg: AgentMessage): Promise<void> {
		switch (msg.type) {
			case "agent_hello":
				console.log(`Agent connected: ${msg.agentId}`);
				break;
			case "check_result":
				await this.handleCheckResult(msg);
				break;
		}
	}

	private async handleCheckResult(msg: Extract<AgentMessage, { type: "check_result" }>): Promise<void> {
		const time = new Date(msg.time);
		const { provider, target, check, result } = msg;

		if (result.ok) {
			await this.recordSuccess(provider, target, check, time, result.measurement, result.violation);
		} else {
			await this.recordError(provider, target, check, time, result.error);
		}
	}

	private async recordSuccess(
		provider: string,
		target: string,
		check: string,
		time: Date,
		measurement: Record<string, unknown>,
		violation?: { code: string; rule: string; threshold: unknown; actual: unknown },
	): Promise<void> {
		await this.outcomeStore.recordProviderOutcome(provider, time, { success: true });
		await this.outcomeStore.recordTargetOutcome(provider, target, time, { success: true });
		await this.outcomeStore.recordCheckOutcome(provider, target, check, time, {
			success: true,
			value: measurement,
			violation,
		});

		await this.events.handleProviderOutcome(provider, time, null);
		await this.events.handleTargetOutcome(provider, target, time, null);

		if (violation) {
			await this.events.handleCheckOutcome(provider, target, check, time, {
				code: violation.code,
				kind: "violation",
				message: `${violation.actual} ${violation.rule} ${violation.threshold}`,
			});
		} else {
			await this.events.handleCheckOutcome(provider, target, check, time, null);
		}
	}

	private async recordError(
		provider: string,
		target: string,
		check: string,
		time: Date,
		error: { level: "provider" | "target" | "check"; code: string; message: string },
	): Promise<void> {
		const { level, code, message } = error;

		if (level === "provider") {
			await this.outcomeStore.recordProviderOutcome(provider, time, { success: false, error });
			await this.events.handleProviderOutcome(provider, time, { code, message });
			await this.events.handleTargetOutcome(provider, target, time, null);
			await this.events.handleCheckOutcome(provider, target, check, time, null);
		} else if (level === "target") {
			await this.outcomeStore.recordProviderOutcome(provider, time, { success: true });
			await this.outcomeStore.recordTargetOutcome(provider, target, time, { success: false, error });
			await this.events.handleProviderOutcome(provider, time, null);
			await this.events.handleTargetOutcome(provider, target, time, { code, message });
			await this.events.handleCheckOutcome(provider, target, check, time, null);
		} else {
			await this.outcomeStore.recordProviderOutcome(provider, time, { success: true });
			await this.outcomeStore.recordTargetOutcome(provider, target, time, { success: true });
			await this.outcomeStore.recordCheckOutcome(provider, target, check, time, { success: false, error });
			await this.events.handleProviderOutcome(provider, time, null);
			await this.events.handleTargetOutcome(provider, target, time, null);
			await this.events.handleCheckOutcome(provider, target, check, time, { code, kind: "error", message });
		}
	}
}
