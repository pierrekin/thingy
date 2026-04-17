import { MantleClient } from "@mantle-team/client";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type GetAuthToken = () => Promise<string | null>;

export type WebSocketState = {
	client: MantleClient | null;
	status: ConnectionStatus;
};

const INITIAL_STATE: WebSocketState = { client: null, status: "connecting" };
const RECONNECT_DELAY_MS = 2000;

let state: WebSocketState = INITIAL_STATE;
const listeners = new Set<() => void>();

let activeClient: MantleClient | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let refCount = 0;
let getAuthToken: GetAuthToken | null = null;

function setState(next: WebSocketState): void {
	state = next;
	for (const listener of listeners) listener();
}

function teardown(): void {
	disconnectTimer = null;
	if (reconnectTimer !== null) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (activeClient) {
		activeClient.disconnect();
		activeClient = null;
	}
	setState(INITIAL_STATE);
}

async function connect(): Promise<void> {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const url = `${protocol}//${window.location.host}/api/ws`;

	setState({ client: null, status: "connecting" });
	const client = new MantleClient(url);
	activeClient = client;

	client.onDisconnect(() => {
		if (activeClient !== client) return;
		activeClient = null;
		setState({ client: null, status: "disconnected" });
		if (refCount > 0) {
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				connect();
			}, RECONNECT_DELAY_MS);
		}
	});

	try {
		await client.connect();
		if (activeClient !== client) return;
		if (getAuthToken) {
			const token = await getAuthToken();
			if (!token) throw new Error("getAuthToken returned null");
			await client.authenticate(token);
		}
		if (activeClient !== client) return;
		setState({ client, status: "connected" });
	} catch (err) {
		console.warn("ws connect failed:", err);
		if (activeClient === client) {
			client.disconnect();
		}
	}
}

export const wsStore = {
	subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},

	getSnapshot(): WebSocketState {
		return state;
	},

	setAuthTokenProvider(fn: GetAuthToken | null): void {
		getAuthToken = fn;
	},

	acquire(): void {
		refCount++;
		if (disconnectTimer !== null) {
			clearTimeout(disconnectTimer);
			disconnectTimer = null;
		}
		if (!activeClient && reconnectTimer === null) {
			connect();
		}
	},

	release(): void {
		refCount = Math.max(0, refCount - 1);
		if (refCount === 0 && disconnectTimer === null) {
			disconnectTimer = setTimeout(teardown, 0);
		}
	},
};
