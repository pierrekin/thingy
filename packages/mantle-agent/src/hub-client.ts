import type { AgentMessage, CheckResultPayload, HubMessage } from "mantle-framework";

const RECONNECT_MS = 2000;

export type AgentRole = "leader" | "standby";

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
	waitForHello: () => Promise<{ instanceId: string; role: AgentRole }>;
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
	let helloResolve: ((value: { instanceId: string; role: AgentRole }) => void) | null = null;

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
				if (msg.type === "hub_hello" && helloResolve) {
					helloResolve({ instanceId: msg.instanceId, role: msg.role });
					helloResolve = null;
				} else if (msg.type === "agent_promote") {
					promoteCallback?.();
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
							connect().then(() => {
								send({ type: "agent_hello", agentId });
							});
						}
					}, RECONNECT_MS);
				}
			};
		});
	}

	const connectPromise = connect();

	const checkReporter: CheckReporter = {
		sendCheckResult(provider, target, check, time, result) {
			send({ type: "check_result", provider, target, check, time: time.getTime(), result });
		},
	};

	return {
		checkReporter,
		onPromote(callback) {
			promoteCallback = callback;
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
