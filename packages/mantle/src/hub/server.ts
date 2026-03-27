import type { Hono } from "hono";
import type { Server, ServerWebSocket } from "bun";
import type { AgentMessage } from "../protocol.ts";
import type { HubService } from "./service.ts";

type WebSocketData = { audience: "web" | "agent" };

export function createFetchHandler(app: Hono) {
	return (req: Request, server: Server<WebSocketData>) => {
		const url = new URL(req.url);

		if (url.pathname === "/api/ws") {
			const upgraded = server.upgrade(req, { data: { audience: "web" } });
			if (upgraded) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		if (url.pathname === "/agent-api/ws") {
			const upgraded = server.upgrade(req, { data: { audience: "agent" } });
			if (upgraded) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		return app.fetch(req);
	};
}

export function createWebSocketHandler(service: HubService) {
	return {
		open(ws: ServerWebSocket<WebSocketData>) {
			if (ws.data.audience === "agent") {
				ws.send(JSON.stringify({ type: "hub_hello" }));
			}
		},
		async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
			if (ws.data.audience === "agent") {
				const msg = JSON.parse(message.toString()) as AgentMessage;
				await service.handleAgentMessage(msg);
			}
		},
		close(ws: ServerWebSocket<WebSocketData>) {},
	};
}
