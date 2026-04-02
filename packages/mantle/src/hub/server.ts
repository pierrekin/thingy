import type { Hono } from "hono";
import type { Server } from "bun";
import type { AgentMessage } from "../protocol.ts";
import type { HubService } from "./service.ts";
import type { WebService } from "./web-service.ts";
import { createMantleSocketHandler, type MantleSocket } from "./mantle-socket.ts";

type WebSocketData = {
	audience: "web" | "agent";
	agentId?: string;
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
	return createMantleSocketHandler<WebSocketData>({
		open(ms: MantleSocket<WebSocketData>) {
			if (ms.data.audience === "agent") {
				ms.send(JSON.stringify({ type: "hub_hello" }));
			}
			// Web clients now subscribe explicitly via messages
		},
		async message(ms: MantleSocket<WebSocketData>, message: string) {
			if (ms.data.audience === "agent") {
				const msg = JSON.parse(message) as AgentMessage;
				if (msg.type === "agent_hello") {
					ms.data.agentId = msg.agentId;
				}
				await hubService.handleAgentMessage(msg, ms.data.agentId);
			} else if (ms.data.audience === "web") {
				// Handle web client subscription messages
				await webService.handleMessage(ms, message);
			}
		},
		close(ms: MantleSocket<WebSocketData>) {
			if (ms.data.audience === "web") {
				webService.handleDisconnect(ms);
			}
		},
	});
}
