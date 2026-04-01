export type MantleSocketConfig = {
	maxSize?: number;
	lingerMs?: number;
};

const DEFAULT_MAX_SIZE = 150 * 1024;
const DEFAULT_LINGER_MS = 15;

/**
 * Drop-in browser WebSocket replacement with outbound coalescing and inbound NDJSON unpacking.
 * Consumers interact with this exactly like a regular WebSocket.
 */
export class MantleSocket {
	private ws: WebSocket;
	private buffer: string[] = [];
	private bufferSize = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly maxSize: number;
	private readonly lingerMs: number;

	onopen: (() => void) | null = null;
	onmessage: ((data: string) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(url: string, config?: MantleSocketConfig) {
		this.maxSize = config?.maxSize ?? DEFAULT_MAX_SIZE;
		this.lingerMs = config?.lingerMs ?? DEFAULT_LINGER_MS;

		this.ws = new WebSocket(url);

		this.ws.onopen = () => {
			this.onopen?.();
		};

		this.ws.onmessage = (event: MessageEvent) => {
			if (!this.onmessage) return;
			const lines = (event.data as string).split("\n");
			for (const line of lines) {
				this.onmessage(line);
			}
		};

		this.ws.onclose = () => {
			this.onclose?.();
		};

		this.ws.onerror = (event: Event) => {
			this.onerror?.(event);
		};
	}

	get readyState(): number {
		return this.ws.readyState;
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

		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(this.buffer.join("\n"));
		}
		this.buffer = [];
		this.bufferSize = 0;
	}

	close(): void {
		this.flush();
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.ws.close();
	}
}
