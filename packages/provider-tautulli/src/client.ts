export class TautulliApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "TautulliApiError";
	}
}

export class TautulliClient {
	constructor(
		private baseUrl: string,
		private apiKey: string,
		private timeoutMs: number,
	) {}

	private async command<T>(cmd: string, params: Record<string, string> = {}): Promise<T> {
		const url = new URL(`${this.baseUrl}/api/v2`);
		url.searchParams.set("apikey", this.apiKey);
		url.searchParams.set("cmd", cmd);
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const res = await fetch(url.toString(), { signal: controller.signal });
			if (res.status === 401) throw new TautulliApiError("auth_failed", "Invalid API key");
			if (res.status === 404) throw new TautulliApiError("not_found", `Not found: ${cmd}`);
			if (!res.ok) throw new TautulliApiError("api_error", `HTTP ${res.status}`);
			const json = await res.json() as { response: { result: string; message?: string; data: T } };
			if (json.response.result !== "success") {
				throw new TautulliApiError("api_error", json.response.message ?? "API returned failure");
			}
			return json.response.data;
		} catch (err) {
			if (err instanceof TautulliApiError) throw err;
			const msg = err instanceof Error ? err.message : String(err);
			throw new TautulliApiError("unreachable", `Cannot connect: ${msg}`);
		} finally {
			clearTimeout(timer);
		}
	}

	async getActivity(): Promise<{ sessions: unknown[] }> {
		const data = await this.command<{ sessions?: unknown[] }>("get_activity");
		return { sessions: data.sessions ?? [] };
	}

	async getHistory(): Promise<{ recordsTotal: number }> {
		return this.command("get_history", { length: "0" });
	}
}
