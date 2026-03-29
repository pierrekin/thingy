import type { Hono } from "hono";
import type { Server, ServerWebSocket } from "bun";
import type { AgentMessage } from "../protocol.ts";
import type { HubService } from "./service.ts";
import type { WebService } from "./web-service.ts";

type WebSocketData = {
	audience: "web" | "agent";
};

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

export function createWebSocketHandler(hubService: HubService, webService: WebService) {
	return {
		async open(ws: ServerWebSocket<WebSocketData>) {
			if (ws.data.audience === "agent") {
				ws.send(JSON.stringify({ type: "hub_hello" }));
			}
			// Web clients now subscribe explicitly via messages
		},
		async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
			const msgStr = message.toString();

			if (ws.data.audience === "agent") {
				const msg = JSON.parse(msgStr) as AgentMessage;
				await hubService.handleAgentMessage(msg);
			} else if (ws.data.audience === "web") {
				// Handle web client subscription messages
				await webService.handleMessage(ws, msgStr);
			}
		},
		close(ws: ServerWebSocket<WebSocketData>) {
			if (ws.data.audience === "web") {
				webService.handleDisconnect(ws);
			}
		},
	};
}
