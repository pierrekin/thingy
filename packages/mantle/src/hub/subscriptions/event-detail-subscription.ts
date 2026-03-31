import { Subscription } from "./base.ts";
import type { ServerWebSocket } from "bun";

export type EventLevel = "provider" | "target" | "check";

export class EventDetailSubscription extends Subscription {
	constructor(
		id: string,
		ws: ServerWebSocket<{ audience: "web" | "agent" }>,
		public readonly eventId: number,
		public readonly eventLevel: EventLevel,
	) {
		super(id, ws);
	}

	getType(): string {
		return "event_detail";
	}
}
