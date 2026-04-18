export class NzbHydra2ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "NzbHydra2ApiError";
  }
}

export type IndexerStatus = {
  indexer: { name: string };
  state: string;
  level: number;
  disabledUntil: string | null;
  lastError: string | null;
  apiHits: number;
  apiHitLimit: number | null;
  downloadHits: number;
  downloadHitLimit: number | null;
};

export class NzbHydra2Client {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeoutMs: number,
  ) {}

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new NzbHydra2ApiError("auth_failed", "Invalid API key");
      }
      if (res.status === 404)
        throw new NzbHydra2ApiError("not_found", `Not found: ${path}`);
      if (!res.ok)
        throw new NzbHydra2ApiError("api_error", `HTTP ${res.status}`);
      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof NzbHydra2ApiError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new NzbHydra2ApiError("unreachable", `Cannot connect: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async getIndexerStatuses(): Promise<IndexerStatus[]> {
    return this.post<IndexerStatus[]>("/api/stats/indexers", {
      apikey: this.apiKey,
    });
  }

  async getSearchCount(): Promise<number> {
    const data = await this.post<{ totalElements: number }>(
      "/api/history/searches",
      {
        apikey: this.apiKey,
        request: {
          sortModel: { column: "time", sortMode: -1 },
          filterModel: {},
        },
      },
    );
    return data.totalElements;
  }

  async getDownloadCount(): Promise<number> {
    const data = await this.post<{ totalElements: number }>(
      "/api/history/downloads",
      {
        apikey: this.apiKey,
        request: {
          sortModel: { column: "time", sortMode: -1 },
          filterModel: {},
        },
      },
    );
    return data.totalElements;
  }
}
