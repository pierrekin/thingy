import { describe, expect, test } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const BAZARR_URL = process.env.BAZARR_URL ?? "http://localhost:6767";
const BAZARR_API_KEY =
  process.env.BAZARR_API_KEY ?? "e2etestapikeyfortesting123bazarr";

async function bazarrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BAZARR_URL}${path}`, {
    headers: { "X-Api-Key": BAZARR_API_KEY },
  });
  if (!res.ok) throw new Error(`Bazarr ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

describe("smoke: api", () => {
  test("system/status returns a version string", async () => {
    const status = await bazarrGet<{ data: { bazarr_version: string } }>(
      "/api/system/status",
    );
    expect(status.data.bazarr_version).toBeString();
    expect(status.data.bazarr_version.length).toBeGreaterThan(0);
  });

  test("system/health returns a data array", async () => {
    const health = await bazarrGet<{ data: unknown[] }>("/api/system/health");
    expect(health.data).toBeArray();
  });

  test("movies/wanted returns data array and total", async () => {
    const result = await bazarrGet<{ data: unknown[]; total: number }>(
      "/api/movies/wanted",
    );
    expect(result.data).toBeArray();
    expect(result.total).toBeNumber();
  });

  test("episodes/wanted returns data array and total", async () => {
    const result = await bazarrGet<{ data: unknown[]; total: number }>(
      "/api/episodes/wanted",
    );
    expect(result.data).toBeArray();
    expect(result.total).toBeNumber();
  });

  test("wrong API key returns 401", async () => {
    const res = await fetch(`${BAZARR_URL}/api/system/status`, {
      headers: { "X-Api-Key": "wrongkeyfortestingpurposes000000" },
    });
    expect(res.status).toBe(401);
  });
});

describe("provider: checks", () => {
  const bazarr = providers.find((p) => p.name === "@mantle/bazarr/remote")!;
  const instance = bazarr.createInstance?.({
    url: BAZARR_URL,
    api_key: BAZARR_API_KEY,
  });

  test("health.issues returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "health" }, ["issues"]);
    expect(expectSuccess(result, "issues")).toBeGreaterThanOrEqual(0);
  });

  test("wanted_movies.count returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "wanted_movies" }, ["count"]);
    expect(expectSuccess(result, "count")).toBeGreaterThanOrEqual(0);
  });

  test("wanted_episodes.count returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "wanted_episodes" }, [
      "count",
    ]);
    expect(expectSuccess(result, "count")).toBeGreaterThanOrEqual(0);
  });
});
