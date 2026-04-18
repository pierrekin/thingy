export class CaddyApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CaddyApiError";
  }
}

export type UpstreamStatus = {
  address: string;
  num_requests: number;
  fails: number;
};

export class CaddyClient {
  constructor(
    private baseUrl: string,
    private timeoutMs: number,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new CaddyApiError("api_error", `HTTP ${res.status}`);
      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof CaddyApiError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new CaddyApiError("unreachable", `Cannot connect: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async getText(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new CaddyApiError("api_error", `HTTP ${res.status}`);
      return res.text();
    } catch (err) {
      if (err instanceof CaddyApiError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new CaddyApiError("unreachable", `Cannot connect: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async getConfigReloadSuccess(): Promise<number> {
    const text = await this.getText("/metrics");
    for (const line of text.split("\n")) {
      if (line.startsWith("caddy_config_last_reload_successful ")) {
        const val = parseFloat(line.split(" ")[1]!);
        if (Number.isNaN(val))
          throw new CaddyApiError(
            "api_error",
            "caddy_config_last_reload_successful metric has non-numeric value",
          );
        return val;
      }
    }
    throw new CaddyApiError(
      "metric_absent",
      "caddy_config_last_reload_successful metric not present in /metrics",
    );
  }

  async getUpstreams(): Promise<UpstreamStatus[]> {
    return this.get<UpstreamStatus[]>("/reverse_proxy/upstreams");
  }
}
