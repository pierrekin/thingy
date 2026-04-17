import { MantleSocket } from "./mantle-socket.ts";
import type {
	ServerMessage,
	StateSubscriptionRequest,
	MetricsSubscriptionRequest,
	EventSubscriptionRequest,
} from "./types.ts";

export type StateFilters = {
	start: number;
	end: number | null;
	bucketDurationMs: number;
};

export type MetricsFilters = {
	provider: string;
	target: string;
	check: string;
	start: number;
	end: number | null;
	bucketDurationMs: number;
};

export type EventFilters = {
	eventId: number;
	eventLevel: "provider" | "target" | "check";
};

export type SubscriptionCallbacks = {
	onMessage: (msg: ServerMessage) => void;
	onComplete?: () => void;
};

export type SubscriptionHandle = {
	id: string;
	unsubscribe(): void;
};

type SubscriptionEntry = {
	callbacks: SubscriptionCallbacks;
};

function generateId(): string {
	return `sub-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export class MantleClient {
	private socket: MantleSocket | null = null;
	private subscriptions = new Map<string, SubscriptionEntry>();
	private disconnectCallbacks = new Set<() => void>();
	private url: string;

	constructor(url: string) {
		this.url = url;
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Set callbacks BEFORE constructing MantleSocket to avoid
			// a race where the WebSocket opens before handlers are assigned.
			const callbacks = {
				onopen: () => resolve(),
				onerror: () => reject(new Error("WebSocket connection failed")),
				onclose: () => {
					this.socket = null;
					for (const cb of this.disconnectCallbacks) {
						cb();
					}
				},
				onmessage: (data: string) => this.handleMessage(data),
			};

			const socket = new MantleSocket(this.url, undefined, callbacks);
			this.socket = socket;
		});
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
	}

	onDisconnect(cb: () => void): () => void {
		this.disconnectCallbacks.add(cb);
		return () => this.disconnectCallbacks.delete(cb);
	}

	authenticate(token: string): void {
		this.send(JSON.stringify({ type: "authenticate", token }));
	}

	subscribe(type: "state", filters: StateFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle;
	subscribe(type: "metrics", filters: MetricsFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle;
	subscribe(type: "event", filters: EventFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle;
	subscribe(type: string, filters: StateFilters | MetricsFilters | EventFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle {
		return this.createSubscription(type, filters, callbacks, false);
	}

	snapshot(type: "state", filters: StateFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle;
	snapshot(type: "metrics", filters: MetricsFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle;
	snapshot(type: string, filters: StateFilters | MetricsFilters, callbacks: SubscriptionCallbacks): SubscriptionHandle {
		return this.createSubscription(type, filters, callbacks, true);
	}

	private createSubscription(
		type: string,
		filters: StateFilters | MetricsFilters | EventFilters,
		callbacks: SubscriptionCallbacks,
		snapshot: boolean,
	): SubscriptionHandle {
		const id = generateId();

		this.subscriptions.set(id, { callbacks });

		let msg: StateSubscriptionRequest | MetricsSubscriptionRequest | EventSubscriptionRequest;

		if (type === "state") {
			const f = filters as StateFilters;
			msg = {
				type: "subscribe_state",
				id,
				start: f.start,
				end: f.end,
				bucketDurationMs: f.bucketDurationMs,
				snapshot: snapshot || undefined,
			};
		} else if (type === "metrics") {
			const f = filters as MetricsFilters;
			msg = {
				type: "subscribe_metrics",
				id,
				provider: f.provider,
				target: f.target,
				check: f.check,
				start: f.start,
				end: f.end,
				bucketDurationMs: f.bucketDurationMs,
				snapshot: snapshot || undefined,
			};
		} else if (type === "event") {
			const f = filters as EventFilters;
			msg = {
				type: "subscribe_event",
				id,
				eventId: f.eventId,
				eventLevel: f.eventLevel,
			};
		} else {
			throw new Error(`Unknown subscription type: ${type}`);
		}

		this.send(JSON.stringify(msg));

		return {
			id,
			unsubscribe: () => {
				this.subscriptions.delete(id);
				this.send(JSON.stringify({ type: "unsubscribe", id }));
			},
		};
	}

	private send(message: string): void {
		if (!this.socket) return;
		// A send on a non-OPEN socket means the connection is dying but our
		// onclose hasn't fired yet. Force the close so disconnect callbacks run,
		// status flips, and consumers re-derive via their reconnect effects —
		// rather than silently losing the message.
		if (this.socket.readyState !== WebSocket.OPEN) {
			this.disconnect();
			return;
		}
		this.socket.send(message);
	}

	private handleMessage(data: string): void {
		let msg: ServerMessage;
		try {
			msg = JSON.parse(data) as ServerMessage;
		} catch {
			return;
		}

		// Messages with subscriptionId
		if ("subscriptionId" in msg) {
			const entry = this.subscriptions.get(msg.subscriptionId);
			if (!entry) return;

			if (msg.type === "snapshot_complete") {
				entry.callbacks.onComplete?.();
				this.subscriptions.delete(msg.subscriptionId);
				return;
			}

			entry.callbacks.onMessage(msg);
			return;
		}

		// Ack/error messages use `id` not `subscriptionId`
		if (msg.type === "subscription_ack") {
			// Subscription confirmed active — no action needed
			return;
		}

		if (msg.type === "subscription_error") {
			// Remove failed subscription
			this.subscriptions.delete(msg.id);
			return;
		}
	}
}
