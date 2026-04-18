import type { Server } from "bun";
import type { Hono } from "hono";
import type { AgentMessage } from "mantle-framework";
import type { AgentConfigRegistry } from "./agent-config-registry.ts";
import type { AgentRegistry } from "./agent-registry.ts";
import type { ChannelSessionManager } from "./channel-session.ts";
import {
  createMantleSocketHandler,
  type MantleSocket,
} from "./mantle-socket.ts";
import type { HubService } from "./service.ts";
import type { SinkSessionManager } from "./sink-session.ts";
import type { WebService } from "./web-service.ts";

type WebData = { audience: "web" };
type AgentData = { audience: "agent"; agentId?: string; instanceId?: string };
type ChannelData = { audience: "channel"; channelId?: string };
type SinkData = { audience: "sink"; sinkId?: string };
type WebSocketData = WebData | AgentData | ChannelData | SinkData;

async function handleAgentMessage(
  ms: MantleSocket<AgentData>,
  message: string,
  hubService: HubService,
  agentRegistry: AgentRegistry,
  agentConfigRegistry: AgentConfigRegistry,
): Promise<void> {
  const msg = JSON.parse(message) as AgentMessage;
  if (msg.type === "agent_hello") {
    ms.data.agentId = msg.agentId;
    const payload = agentConfigRegistry.get(msg.agentId);
    if (!payload) {
      const known = agentConfigRegistry.knownIds().join(", ") || "(none)";
      ms.send(
        JSON.stringify({
          type: "agent_reject",
          reason: `Unknown agent '${msg.agentId}'. Expected one of: ${known}`,
          code: "unknown_agent",
        }),
      );
      ms.close();
      console.log(`Rejected agent_hello from unknown agent '${msg.agentId}'`);
      return;
    }
    const instance = agentRegistry.add(msg.agentId, ms);
    ms.send(
      JSON.stringify({
        type: "hub_hello",
        instanceId: instance.instanceId,
        role: instance.role,
        agentConfig: payload.agentConfig,
        providerConfigs: payload.providerConfigs,
      }),
    );
    console.log(
      `Agent '${msg.agentId}' connected as ${instance.role} (instance: ${instance.instanceId})`,
    );
  }
  await hubService.handleAgentMessage(msg, ms.data.agentId);
}

function handleAgentClose(
  ms: MantleSocket<AgentData>,
  agentRegistry: AgentRegistry,
): void {
  const { instanceId, agentId } = ms.data;
  if (!instanceId) return;

  const promoted = agentRegistry.remove(instanceId);
  console.log(`Agent '${agentId}' disconnected (instance: ${instanceId})`);

  if (promoted) {
    console.log(
      `Agent '${promoted.agentId}' promoted instance ${promoted.instanceId} to leader`,
    );
    promoted.socket.send(
      JSON.stringify({
        type: "agent_promote",
        instanceId: promoted.instanceId,
      }),
    );
  }
}

async function handleChannelMessage(
  ms: MantleSocket<ChannelData>,
  message: string,
  channelSessionManager: ChannelSessionManager,
): Promise<void> {
  const msg = JSON.parse(message) as {
    type: string;
    channelId?: string;
    cursor?: number;
  };
  if (msg.type === "channel_hello" && msg.channelId) {
    ms.data.channelId = msg.channelId;
    await channelSessionManager.handleHello(ms, msg.channelId);
  } else if (msg.type === "channel_ack" && msg.cursor !== undefined) {
    await channelSessionManager.handleAck(ms, msg.cursor);
  }
}

async function handleSinkMessage(
  ms: MantleSocket<SinkData>,
  message: string,
  sinkSessionManager: SinkSessionManager,
): Promise<void> {
  const msg = JSON.parse(message) as {
    type: string;
    sinkId?: string;
    cursor?: number;
  };
  if (msg.type === "sink_hello" && msg.sinkId) {
    ms.data.sinkId = msg.sinkId;
    await sinkSessionManager.handleHello(ms, msg.sinkId);
  } else if (msg.type === "sink_ack" && msg.cursor !== undefined) {
    await sinkSessionManager.handleAck(ms, msg.cursor);
  }
}

export function createFetchHandler(app: Hono) {
  return (req: Request, server: Server<WebSocketData>) => {
    const url = new URL(req.url);

    if (url.pathname === "/api/ws") {
      const upgraded = server.upgrade(req, {
        data: { audience: "web" } as WebData,
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/agent-api/ws") {
      const upgraded = server.upgrade(req, {
        data: { audience: "agent" } as AgentData,
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/channel-api/ws") {
      const upgraded = server.upgrade(req, {
        data: { audience: "channel" } as ChannelData,
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/sink-api/ws") {
      const upgraded = server.upgrade(req, {
        data: { audience: "sink" } as SinkData,
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return app.fetch(req);
  };
}

export function createWebSocketHandler(
  hubService: HubService,
  webService: WebService,
  channelSessionManager: ChannelSessionManager,
  sinkSessionManager: SinkSessionManager,
  agentRegistry: AgentRegistry,
  agentConfigRegistry: AgentConfigRegistry,
) {
  return createMantleSocketHandler<WebSocketData>({
    async message(ms: MantleSocket<WebSocketData>, message: string) {
      const { data } = ms;
      if (data.audience === "agent") {
        await handleAgentMessage(
          ms as MantleSocket<AgentData>,
          message,
          hubService,
          agentRegistry,
          agentConfigRegistry,
        );
      } else if (data.audience === "web") {
        await webService.handleMessage(ms, message);
      } else if (data.audience === "channel") {
        await handleChannelMessage(
          ms as MantleSocket<ChannelData>,
          message,
          channelSessionManager,
        );
      } else if (data.audience === "sink") {
        await handleSinkMessage(
          ms as MantleSocket<SinkData>,
          message,
          sinkSessionManager,
        );
      }
    },
    close(ms: MantleSocket<WebSocketData>) {
      const { data } = ms;
      if (data.audience === "agent") {
        handleAgentClose(ms as MantleSocket<AgentData>, agentRegistry);
      } else if (data.audience === "web") {
        webService.handleDisconnect(ms);
      } else if (data.audience === "channel") {
        channelSessionManager.handleDisconnect(ms as MantleSocket<ChannelData>);
      } else if (data.audience === "sink") {
        sinkSessionManager.handleDisconnect(ms as MantleSocket<SinkData>);
      }
    },
  });
}
