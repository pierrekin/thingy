import { describe, expect, test } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const PROWLARR_URL = process.env.PROWLARR_URL ?? "http://localhost:9696";
const PROWLARR_API_KEY =
  process.env.PROWLARR_API_KEY ?? "e2etestapikeyfortesting12345678";

async function prowlarrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PROWLARR_URL}${path}`, {
    headers: { "X-Api-Key": PROWLARR_API_KEY },
  });
  if (!res.ok) throw new Error(`Prowlarr ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

describe("smoke: api", () => {
  test("ping is reachable without auth", async () => {
    const res = await fetch(`${PROWLARR_URL}/ping`);
    expect(res.ok).toBe(true);
  });

  test("system/status returns a version string", async () => {
    const status = await prowlarrGet<{ version: string }>(
      "/api/v1/system/status",
    );
    expect(status.version).toBeString();
    expect(status.version.length).toBeGreaterThan(0);
  });

  test("health returns an array of items with expected shape", async () => {
    const health =
      await prowlarrGet<{ source: string; type: string; message: string }[]>(
        "/api/v1/health",
      );
    expect(health).toBeArray();
    for (const item of health) {
      expect(item.source).toBeString();
      expect(item.type).toBeString();
      expect(item.message).toBeString();
    }
  });

  test("indexer returns an array", async () => {
    const indexers = await prowlarrGet<unknown[]>("/api/v1/indexer");
    expect(indexers).toBeArray();
  });
});

describe("provider: checks", () => {
  const prowlarr = providers.find((p) => p.name === "@mantle/prowlarr/remote")!;
  const instance = prowlarr.createInstance?.({
    url: PROWLARR_URL,
    api_key: PROWLARR_API_KEY,
  });

  test("health.errors returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "health" }, ["errors"]);
    expect(expectSuccess(result, "errors")).toBeGreaterThanOrEqual(0);
  });

  test("health.warnings returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "health" }, ["warnings"]);
    expect(expectSuccess(result, "warnings")).toBeGreaterThanOrEqual(0);
  });
});
