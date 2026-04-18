export class BazarrApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BazarrApiError";
  }
}

export class BazarrClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeoutMs: number,
  ) {}

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { "X-Api-Key": this.apiKey },
        signal: controller.signal,
      });
      if (res.status === 401)
        throw new BazarrApiError("auth_failed", "Invalid API key");
      if (res.status === 404)
        throw new BazarrApiError("not_found", `Not found: ${path}`);
      if (!res.ok) throw new BazarrApiError("api_error", `HTTP ${res.status}`);
      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof BazarrApiError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BazarrApiError("unreachable", `Cannot connect: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async getStatus(): Promise<{ bazarr_version: string }> {
    const res = await this.request<{ data: { bazarr_version: string } }>(
      "/api/system/status",
    );
    return res.data;
  }

  async getHealth(): Promise<Array<{ object: string; issue: string }>> {
    const res = await this.request<{
      data: Array<{ object: string; issue: string }>;
    }>("/api/system/health");
    return res.data;
  }

  async getWantedMovies(): Promise<{ data: unknown[]; total: number }> {
    return this.request("/api/movies/wanted");
  }

  async getWantedEpisodes(): Promise<{ data: unknown[]; total: number }> {
    return this.request("/api/episodes/wanted");
  }
}
