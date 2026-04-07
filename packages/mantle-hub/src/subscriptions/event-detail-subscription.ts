import { Subscription } from "./base.ts";
import type { MantleSocket } from "../mantle-socket.ts";

export type EventLevel = "provider" | "target" | "check";

export class EventDetailSubscription extends Subscription {
	constructor(
		id: string,
		ws: MantleSocket<{ audience: "web" | "agent" }>,
		public readonly eventId: number,
		public readonly eventLevel: EventLevel,
	) {
		super(id, ws);
	}

	getType(): string {
		return "event_detail";
	}
}
