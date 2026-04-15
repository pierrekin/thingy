import type { Hono } from "hono";
import type { Server } from "bun";
import type { AgentMessage } from "mantle-framework";
import type { HubService } from "./service.ts";
import type { WebService } from "./web-service.ts";
import type { ChannelSessionManager } from "./channel-session.ts";
import { createMantleSocketHandler, type MantleSocket } from "./mantle-socket.ts";

type WebData = { audience: "web" };
type AgentData = { audience: "agent"; agentId?: string };
type ChannelData = { audience: "channel"; channelId?: string };
type WebSocketData = WebData | AgentData | ChannelData;

function handleAgentOpen(ms: MantleSocket<AgentData>): void {
	ms.send(JSON.stringify({ type: "hub_hello" }));
}

async function handleAgentMessage(ms: MantleSocket<AgentData>, message: string, hubService: HubService): Promise<void> {
	const msg = JSON.parse(message) as AgentMessage;
	if (msg.type === "agent_hello") {
		ms.data.agentId = msg.agentId;
	}
	await hubService.handleAgentMessage(msg, ms.data.agentId);
}

async function handleChannelMessage(ms: MantleSocket<ChannelData>, message: string, channelSessionManager: ChannelSessionManager): Promise<void> {
	const msg = JSON.parse(message) as { type: string; channelId?: string; cursor?: number };
	if (msg.type === "channel_hello" && msg.channelId) {
		ms.data.channelId = msg.channelId;
		await channelSessionManager.handleHello(ms, msg.channelId);
	} else if (msg.type === "channel_ack" && msg.cursor !== undefined) {
		await channelSessionManager.handleAck(ms, msg.cursor);
	}
}

export function createFetchHandler(app: Hono) {
	return (req: Request, server: Server<WebSocketData>) => {
		const url = new URL(req.url);

		if (url.pathname === "/api/ws") {
			const upgraded = server.upgrade(req, { data: { audience: "web" } as WebData });
			if (upgraded) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		if (url.pathname === "/agent-api/ws") {
			const upgraded = server.upgrade(req, { data: { audience: "agent" } as AgentData });
			if (upgraded) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		if (url.pathname === "/channel-api/ws") {
			const upgraded = server.upgrade(req, { data: { audience: "channel" } as ChannelData });
			if (upgraded) return undefined;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		return app.fetch(req);
	};
}

export function createWebSocketHandler(hubService: HubService, webService: WebService, channelSessionManager: ChannelSessionManager) {
	return createMantleSocketHandler<WebSocketData>({
		open(ms: MantleSocket<WebSocketData>) {
			if (ms.data.audience === "agent") {
				handleAgentOpen(ms as MantleSocket<AgentData>);
			}
		},
		async message(ms: MantleSocket<WebSocketData>, message: string) {
			const { data } = ms;
			if (data.audience === "agent") {
				await handleAgentMessage(ms as MantleSocket<AgentData>, message, hubService);
			} else if (data.audience === "web") {
				await webService.handleMessage(ms, message);
			} else if (data.audience === "channel") {
				await handleChannelMessage(ms as MantleSocket<ChannelData>, message, channelSessionManager);
			}
		},
		close(ms: MantleSocket<WebSocketData>) {
			const { data } = ms;
			if (data.audience === "web") {
				webService.handleDisconnect(ms);
			} else if (data.audience === "channel") {
				channelSessionManager.handleDisconnect(ms as MantleSocket<ChannelData>);
			}
		},
	});
}
