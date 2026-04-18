export class MylarrApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MylarrApiError";
  }
}

export class MylarrClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeoutMs: number,
  ) {}

  private async request<T>(
    cmd: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/`);
    url.searchParams.set("apikey", this.apiKey);
    url.searchParams.set("cmd", cmd);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) throw new MylarrApiError("api_error", `HTTP ${res.status}`);
      const json = await res.json();
      // Some commands (e.g. getWanted) return data directly without the success envelope.
      // Auth/error responses always use the envelope, so envelope-detection is safe.
      if (typeof json === "object" && json !== null && "success" in json) {
        const envelope = json as {
          success: boolean;
          data?: T;
          error?: { code: number; message: string };
        };
        if (!envelope.success) {
          const msg = envelope.error?.message ?? "Unknown error";
          if (msg.includes("API key") || msg.includes("API not enabled")) {
            throw new MylarrApiError("auth_failed", msg);
          }
          if (msg.includes("No comic found")) {
            throw new MylarrApiError("not_found", msg);
          }
          throw new MylarrApiError("api_error", msg);
        }
        return envelope.data as T;
      }
      return json as T;
    } catch (err) {
      if (err instanceof MylarrApiError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new MylarrApiError("unreachable", `Cannot connect: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async getVersion(): Promise<{
    current_version: string;
    latest_version: string;
    commits_behind: number;
  }> {
    return this.request("getVersion");
  }

  async getComic(id: string): Promise<{
    comic: Array<{
      id: string;
      name: string;
      status: string;
      totalIssues: number;
    }>;
    issues: Array<{ id: string; status: string }>;
    annuals: Array<{ id: string; status: string }>;
  }> {
    return this.request("getComic", { id });
  }

  async getWanted(): Promise<{
    issues: Array<{
      ComicName: string;
      Issue_Number: string;
      ComicID: string;
      IssueID: string;
    }>;
    annuals?: Array<{ ComicName: string; IssueID: string }>;
  }> {
    return this.request("getWanted");
  }
}
