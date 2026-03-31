import type { OutcomeStore, EventStore, BucketStore, BucketStatus } from "../store/types.ts";
import type { AgentMessage } from "../protocol.ts";
import { EventTracker } from "../agent/events.ts";
import type {
	ProviderBucketPublisher,
	TargetBucketPublisher,
	CheckBucketPublisher,
	ProviderEventPublisher,
	TargetEventPublisher,
	CheckEventPublisher,
} from "./pubsub.ts";
import { getBucketBounds, DEFAULT_BUCKET_CONFIG, type BucketConfig } from "./buckets.ts";

type BucketPublishers = {
	provider: ProviderBucketPublisher;
	target: TargetBucketPublisher;
	check: CheckBucketPublisher;
};

type EventPublishers = {
	provider: ProviderEventPublisher;
	target: TargetEventPublisher;
	check: CheckEventPublisher;
};

export class HubService {
	private events: EventTracker;
	private bucketConfig: BucketConfig;
	private bucketPublishers: BucketPublishers;

	constructor(
		private outcomeStore: OutcomeStore,
		eventStore: EventStore,
		private bucketStore: BucketStore,
		bucketPublishers: BucketPublishers,
		eventPublishers: EventPublishers,
		bucketConfig: BucketConfig = DEFAULT_BUCKET_CONFIG,
	) {
		this.bucketPublishers = bucketPublishers;
		this.events = new EventTracker(eventStore, eventPublishers);
		this.bucketConfig = bucketConfig;
	}

	async init(): Promise<void> {
		await this.events.loadOpenEvents();
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

		// Update bucket statuses
		const checkStatus: BucketStatus = violation ? "red" : "green";
		await this.updateBuckets(provider, target, check, time, {
			provider: "green",
			target: "green",
			check: checkStatus,
		});
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

			await this.updateBuckets(provider, target, check, time, {
				provider: "red",
				target: "grey",
				check: "grey",
			});
		} else if (level === "target") {
			await this.outcomeStore.recordProviderOutcome(provider, time, { success: true });
			await this.outcomeStore.recordTargetOutcome(provider, target, time, { success: false, error });
			await this.events.handleProviderOutcome(provider, time, null);
			await this.events.handleTargetOutcome(provider, target, time, { code, message });
			await this.events.handleCheckOutcome(provider, target, check, time, null);

			await this.updateBuckets(provider, target, check, time, {
				provider: "green",
				target: "red",
				check: "grey",
			});
		} else {
			await this.outcomeStore.recordProviderOutcome(provider, time, { success: true });
			await this.outcomeStore.recordTargetOutcome(provider, target, time, { success: true });
			await this.outcomeStore.recordCheckOutcome(provider, target, check, time, { success: false, error });
			await this.events.handleProviderOutcome(provider, time, null);
			await this.events.handleTargetOutcome(provider, target, time, null);
			await this.events.handleCheckOutcome(provider, target, check, time, { code, kind: "error", message });

			await this.updateBuckets(provider, target, check, time, {
				provider: "green",
				target: "green",
				check: "red",
			});
		}
	}

	private async updateBuckets(
		provider: string,
		target: string,
		check: string,
		time: Date,
		statuses: { provider: BucketStatus; target: BucketStatus; check: BucketStatus },
	): Promise<void> {
		const { start, end } = getBucketBounds(time, this.bucketConfig);

		// Check bucket
		const oldCheckStatus = await this.bucketStore.getCheckBucketStatus(provider, target, check, start);
		const newCheckStatus = this.mergeStatus(oldCheckStatus, statuses.check);

		if (oldCheckStatus !== newCheckStatus) {
			await this.bucketStore.setCheckBucket(provider, target, check, start, end, newCheckStatus);
			this.bucketPublishers.check.publish({
				provider,
				target,
				check,
				bucketStart: start,
				bucketEnd: end,
				status: newCheckStatus,
			});
		}

		// Target bucket
		const oldTargetStatus = await this.bucketStore.getTargetBucketStatus(provider, target, start);
		const newTargetStatus = this.mergeStatus(oldTargetStatus, this.aggregateUp(statuses.target, newCheckStatus));

		if (oldTargetStatus !== newTargetStatus) {
			await this.bucketStore.setTargetBucket(provider, target, start, end, newTargetStatus);
			this.bucketPublishers.target.publish({
				provider,
				target,
				bucketStart: start,
				bucketEnd: end,
				status: newTargetStatus,
			});
		}

		// Provider bucket
		const oldProviderStatus = await this.bucketStore.getProviderBucketStatus(provider, start);
		const newProviderStatus = this.mergeStatus(oldProviderStatus, this.aggregateUp(statuses.provider, newTargetStatus));

		if (oldProviderStatus !== newProviderStatus) {
			await this.bucketStore.setProviderBucket(provider, start, end, newProviderStatus);
			this.bucketPublishers.provider.publish({
				provider,
				bucketStart: start,
				bucketEnd: end,
				status: newProviderStatus,
			});
		}
	}

	private mergeStatus(existing: BucketStatus | undefined, incoming: BucketStatus): BucketStatus {
		if (existing === "red" || incoming === "red") return "red";
		if (existing === "green" || incoming === "green") return "green";
		if (existing === "grey" || incoming === "grey") return "grey";
		return null;
	}

	private aggregateUp(parentDirect: BucketStatus, childStatus: BucketStatus): BucketStatus {
		if (parentDirect === "red" || childStatus === "red") return "red";
		if (parentDirect === "green" || childStatus === "green") return "green";
		if (parentDirect === "grey" || childStatus === "grey") return "grey";
		return null;
	}
}
