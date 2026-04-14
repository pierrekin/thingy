export class JellyfinApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "JellyfinApiError";
	}
}

export class JellyfinClient {
	constructor(
		private baseUrl: string,
		private token: string,
		private timeoutMs: number,
	) {}

	private async request<T>(path: string): Promise<T> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const res = await fetch(`${this.baseUrl}${path}`, {
				headers: { "X-Emby-Token": this.token },
				signal: controller.signal,
			});
			if (res.status === 401) throw new JellyfinApiError("auth_failed", "Invalid or expired token");
			if (res.status === 403) throw new JellyfinApiError("auth_failed", "Insufficient permissions");
			if (res.status === 404) throw new JellyfinApiError("not_found", `Not found: ${path}`);
			if (!res.ok) throw new JellyfinApiError("api_error", `HTTP ${res.status}`);
			return res.json() as Promise<T>;
		} catch (err) {
			if (err instanceof JellyfinApiError) throw err;
			const msg = err instanceof Error ? err.message : String(err);
			throw new JellyfinApiError("unreachable", `Cannot connect: ${msg}`);
		} finally {
			clearTimeout(timer);
		}
	}

	async getSessions(activeWithinSeconds = 60): Promise<Array<{ Id: string }>> {
		return this.request(`/Sessions?activeWithinSeconds=${activeWithinSeconds}`);
	}
}
