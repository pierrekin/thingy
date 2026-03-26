import type { Hono } from "hono";
import type { Server, ServerWebSocket } from "bun";

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

export const websocket = {
	open(ws: ServerWebSocket<WebSocketData>) {
		console.log(`WebSocket connected: ${ws.data.audience}`);
	},
	message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
		console.log(`WebSocket message (${ws.data.audience}):`, message);
		ws.send(`echo: ${message}`);
	},
	close(ws: ServerWebSocket<WebSocketData>) {
		console.log(`WebSocket disconnected: ${ws.data.audience}`);
	},
};
