import type { AgentMessage, CheckResultPayload } from "../protocol.ts";

export interface CheckReporter {
	sendCheckResult(
		provider: string,
		target: string,
		check: string,
		time: Date,
		result: CheckResultPayload,
	): void;
}

export async function createHubReporters(
	agentId: string,
	hubUrl: string,
): Promise<{ checkReporter: CheckReporter; close: () => void }> {
	const wsUrl = hubUrl.replace(/^http/, "ws") + "/agent-api/ws";

	const ws = await new Promise<WebSocket>((resolve, reject) => {
		const socket = new WebSocket(wsUrl);

		socket.onopen = () => {
			socket.send(JSON.stringify({ type: "agent_hello", agentId }));
			resolve(socket);
		};

		socket.onerror = (err) => {
			reject(new Error(`WebSocket error: ${err}`));
		};

		socket.onclose = () => {
			console.log("Disconnected from hub");
		};
	});

	function send(msg: AgentMessage): void {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(msg));
		}
	}

	const checkReporter: CheckReporter = {
		sendCheckResult(
			provider: string,
			target: string,
			check: string,
			time: Date,
			result: CheckResultPayload,
		): void {
			send({
				type: "check_result",
				provider,
				target,
				check,
				time: time.getTime(),
				result,
			});
		},
	};

	return {
		checkReporter,
		close: () => ws.close(),
	};
}
