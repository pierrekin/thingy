import type { AgentMessage, CheckResultPayload, HubMessage, ResolvedAgentConfig } from "mantle-framework";

const RECONNECT_MS = 2000;

export type AgentRole = "leader" | "standby";

export type HelloResult =
	| {
			type: "ok";
			instanceId: string;
			role: AgentRole;
			agentConfig: ResolvedAgentConfig;
			providerConfigs: Record<string, unknown>;
	  }
	| {
			type: "rejected";
			reason: string;
			code: "unknown_agent";
	  };

export interface CheckReporter {
	sendCheckResult(
		provider: string,
		target: string,
		check: string,
		time: Date,
		result: CheckResultPayload,
	): void;
}

export interface HubConnection {
	checkReporter: CheckReporter;
	onPromote: (callback: () => void) => void;
	waitForHello: () => Promise<HelloResult>;
	close: () => void;
}

export function createHubConnection(
	agentId: string,
	hubUrl: string,
): HubConnection {
	const wsUrl = hubUrl.replace(/^http/, "ws") + "/agent-api/ws";

	let ws: WebSocket | null = null;
	let closed = false;
	let promoteCallback: (() => void) | null = null;
	let pendingPromote = false;
	let helloResolve: ((value: HelloResult) => void) | null = null;

	function send(msg: AgentMessage): void {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(msg));
		}
	}

	function connect(): Promise<void> {
		return new Promise((resolve) => {
			const socket = new WebSocket(wsUrl);

			socket.onopen = () => {
				socket.send(JSON.stringify({ type: "agent_hello", agentId }));
				ws = socket;
				resolve();
			};

			socket.onmessage = (event) => {
				const msg = JSON.parse(event.data as string) as HubMessage;
				if (msg.type === "hub_hello") {
					if (helloResolve) {
						helloResolve({
							type: "ok",
							instanceId: msg.instanceId,
							role: msg.role,
							agentConfig: msg.agentConfig,
							providerConfigs: msg.providerConfigs,
						});
						helloResolve = null;
					}
				} else if (msg.type === "agent_reject") {
					closed = true;
					if (helloResolve) {
						helloResolve({ type: "rejected", reason: msg.reason, code: msg.code });
						helloResolve = null;
					}
					ws?.close();
				} else if (msg.type === "agent_promote") {
					if (promoteCallback) {
						promoteCallback();
					} else {
						pendingPromote = true;
					}
				}
			};

			socket.onerror = () => {
				// onclose will fire after this, reconnect happens there
			};

			socket.onclose = () => {
				ws = null;
				if (!closed) {
					console.log(`Disconnected from hub, reconnecting in ${RECONNECT_MS}ms...`);
					setTimeout(() => {
						if (!closed) {
							connect();
						}
					}, RECONNECT_MS);
				}
			};
		});
	}

	void connect();

	const checkReporter: CheckReporter = {
		sendCheckResult(provider, target, check, time, result) {
			send({ type: "check_result", provider, target, check, time: time.getTime(), result });
		},
	};

	return {
		checkReporter,
		onPromote(callback) {
			promoteCallback = callback;
			if (pendingPromote) {
				pendingPromote = false;
				callback();
			}
		},
		waitForHello() {
			return new Promise((resolve) => {
				helloResolve = resolve;
			});
		},
		close() {
			closed = true;
			ws?.close();
		},
	};
}
