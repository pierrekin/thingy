import type { ServerWebSocket } from "bun";

export type MantleSocketHandler<T> = {
	open?: (ms: MantleSocket<T>) => void | Promise<void>;
	message?: (ms: MantleSocket<T>, message: string) => void | Promise<void>;
	close?: (ms: MantleSocket<T>) => void;
};

export type MantleSocketConfig = {
	maxSize?: number;
	lingerMs?: number;
};

const DEFAULT_MAX_SIZE = 150 * 1024;
const DEFAULT_LINGER_MS = 15;

export class MantleSocket<T> {
	private buffer: string[] = [];
	private bufferSize = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly maxSize: number;
	private readonly lingerMs: number;

	constructor(
		private readonly ws: ServerWebSocket<T>,
		config?: MantleSocketConfig,
	) {
		this.maxSize = config?.maxSize ?? DEFAULT_MAX_SIZE;
		this.lingerMs = config?.lingerMs ?? DEFAULT_LINGER_MS;
	}

	get data(): T {
		return this.ws.data;
	}

	send(message: string): void {
		this.buffer.push(message);
		this.bufferSize += message.length;

		if (this.bufferSize >= this.maxSize) {
			this.flush();
		} else if (this.timer === null) {
			this.timer = setTimeout(() => this.flush(), this.lingerMs);
		}
	}

	flush(): void {
		if (this.buffer.length === 0) return;

		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.ws.send(this.buffer.join("\n"));
		this.buffer = [];
		this.bufferSize = 0;
	}

	close(): void {
		this.flush();
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}

/**
 * Creates a Bun-compatible websocket handler that wraps connections in MantleSocket.
 * Consumers only interact with MantleSocket — the raw ServerWebSocket is hidden.
 */
export function createMantleSocketHandler<T>(
	handler: MantleSocketHandler<T>,
	config?: MantleSocketConfig,
) {
	const sockets = new Map<ServerWebSocket<T>, MantleSocket<T>>();

	return {
		open(ws: ServerWebSocket<T>) {
			const ms = new MantleSocket(ws, config);
			sockets.set(ws, ms);
			handler.open?.(ms);
		},

		async message(ws: ServerWebSocket<T>, raw: string | Buffer) {
			const ms = sockets.get(ws);
			if (!ms || !handler.message) return;

			const data = raw.toString();
			const lines = data.split("\n");
			for (const line of lines) {
				await handler.message(ms, line);
			}
		},

		close(ws: ServerWebSocket<T>) {
			const ms = sockets.get(ws);
			if (!ms) return;

			ms.close();
			handler.close?.(ms);
			sockets.delete(ws);
		},
	};
}
