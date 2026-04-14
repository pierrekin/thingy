import { describe, test, expect } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const WHISPARR_URL = process.env.WHISPARR_URL ?? "http://localhost:6969";
const WHISPARR_API_KEY = process.env.WHISPARR_API_KEY ?? "e2etestapikeyfortesting12345678";

async function whisparrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${WHISPARR_URL}${path}`, {
    headers: { "X-Api-Key": WHISPARR_API_KEY },
  });
  if (!res.ok) throw new Error(`Whisparr ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

describe("smoke: api", () => {
  test("ping is reachable without auth", async () => {
    const res = await fetch(`${WHISPARR_URL}/ping`);
    expect(res.ok).toBe(true);
  });

  test("system/status returns a version string", async () => {
    const status = await whisparrGet<{ version: string }>("/api/v3/system/status");
    expect(status.version).toBeString();
    expect(status.version.length).toBeGreaterThan(0);
  });

  test("health returns an array of items with expected shape", async () => {
    const health = await whisparrGet<{ source: string; type: string; message: string }[]>("/api/v3/health");
    expect(health).toBeArray();
    for (const item of health) {
      expect(item.source).toBeString();
      expect(item.type).toBeString();
      expect(item.message).toBeString();
    }
  });

  test("queue returns totalRecords and records array", async () => {
    const queue = await whisparrGet<{ totalRecords: number; records: unknown[] }>("/api/v3/queue");
    expect(queue.totalRecords).toBeNumber();
    expect(queue.records).toBeArray();
  });
});

describe("provider: checks", () => {
  const whisparrV2 = providers.find((p) => p.name === "@mantle/whisparr-v2/remote")!;
  const instance = whisparrV2.createInstance!({ url: WHISPARR_URL, api_key: WHISPARR_API_KEY });

  test("health.errors returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "health" }, ["errors"]);
    expect(expectSuccess(result, "errors")).toBeGreaterThanOrEqual(0);
  });

  test("health.warnings returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "health" }, ["warnings"]);
    expect(expectSuccess(result, "warnings")).toBeGreaterThanOrEqual(0);
  });

  test("queue.size returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "queue" }, ["size"]);
    expect(expectSuccess(result, "size")).toBeGreaterThanOrEqual(0);
  });

  test("queue.errors returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "queue" }, ["errors"]);
    expect(expectSuccess(result, "errors")).toBeGreaterThanOrEqual(0);
  });
});
