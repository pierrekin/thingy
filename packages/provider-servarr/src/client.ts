export class ServarrApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ServarrApiError";
	}
}

abstract class ServarrBaseClient {
	constructor(
		protected baseUrl: string,
		protected apiKey: string,
		protected timeoutMs: number,
	) {}

	protected async request<T>(path: string): Promise<T> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const res = await fetch(`${this.baseUrl}${path}`, {
				headers: { "X-Api-Key": this.apiKey },
				signal: controller.signal,
			});
			if (res.status === 401) throw new ServarrApiError("auth_failed", "Invalid API key");
			if (res.status === 404) throw new ServarrApiError("not_found", `Not found: ${path}`);
			if (!res.ok) throw new ServarrApiError("api_error", `HTTP ${res.status}`);
			return res.json() as Promise<T>;
		} catch (err) {
			if (err instanceof ServarrApiError) throw err;
			const msg = err instanceof Error ? err.message : String(err);
			throw new ServarrApiError("unreachable", `Cannot connect: ${msg}`);
		} finally {
			clearTimeout(timer);
		}
	}
}

// Sonarr, Radarr, Whisparr
export class ServarrClientV3 extends ServarrBaseClient {
	async getHealth(): Promise<{ source: string; type: string; message: string }[]> {
		return this.request("/api/v3/health");
	}

	async getQueue(): Promise<{ totalRecords: number; records: { status: string; errorMessage?: string }[] }> {
		return this.request("/api/v3/queue");
	}

	async getSeries(id: number): Promise<{ monitored: boolean; statistics: { episodeFileCount: number; totalEpisodeCount: number } }> {
		return this.request(`/api/v3/series/${id}`);
	}

	async getMovie(id: number): Promise<{ monitored: boolean; hasFile: boolean }> {
		return this.request(`/api/v3/movie/${id}`);
	}

	async getScene(id: number): Promise<{ monitored: boolean; hasFile: boolean }> {
		return this.request(`/api/v3/movie/${id}`);
	}
}

// Lidarr, Readarr, Prowlarr
export class ServarrClientV1 extends ServarrBaseClient {
	async getHealth(): Promise<{ source: string; type: string; message: string }[]> {
		return this.request("/api/v1/health");
	}

	async getQueue(): Promise<{ totalRecords: number; records: { status: string; errorMessage?: string }[] }> {
		return this.request("/api/v1/queue");
	}

	async getArtist(id: number): Promise<{ monitored: boolean; statistics: { trackFileCount: number; totalTrackCount: number } }> {
		return this.request(`/api/v1/artist/${id}`);
	}

	async getIndexer(id: number): Promise<{ enableRss: boolean; enableAutomaticSearch: boolean }> {
		return this.request(`/api/v1/indexer/${id}`);
	}
}
