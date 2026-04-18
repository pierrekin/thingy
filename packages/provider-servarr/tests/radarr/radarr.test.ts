import { describe, expect, test } from "bun:test";
import { invariant } from "mantle-framework";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const RADARR_URL = process.env.RADARR_URL ?? "http://localhost:7878";
const RADARR_API_KEY =
  process.env.RADARR_API_KEY ?? "e2etestapikeyfortesting12345678";

async function radarrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${RADARR_URL}${path}`, {
    headers: { "X-Api-Key": RADARR_API_KEY },
  });
  if (!res.ok) throw new Error(`Radarr ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

describe("smoke: api", () => {
  test("ping is reachable without auth", async () => {
    const res = await fetch(`${RADARR_URL}/ping`);
    expect(res.ok).toBe(true);
  });

  test("system/status returns a version string", async () => {
    const status = await radarrGet<{ version: string }>(
      "/api/v3/system/status",
    );
    expect(status.version).toBeString();
    expect(status.version.length).toBeGreaterThan(0);
  });

  test("health returns an array of items with expected shape", async () => {
    const health =
      await radarrGet<{ source: string; type: string; message: string }[]>(
        "/api/v3/health",
      );
    expect(health).toBeArray();
    for (const item of health) {
      expect(item.source).toBeString();
      expect(item.type).toBeString();
      expect(item.message).toBeString();
    }
  });

  test("diskspace returns entries with freeSpace and totalSpace", async () => {
    const disks =
      await radarrGet<{ freeSpace: number; totalSpace: number }[]>(
        "/api/v3/diskspace",
      );
    expect(disks).toBeArray();
    expect(disks.length).toBeGreaterThan(0);
    for (const disk of disks) {
      expect(disk.freeSpace).toBeNumber();
      expect(disk.totalSpace).toBeGreaterThan(0);
    }
  });

  test("queue returns totalRecords and records array", async () => {
    const queue = await radarrGet<{ totalRecords: number; records: unknown[] }>(
      "/api/v3/queue",
    );
    expect(queue.totalRecords).toBeNumber();
    expect(queue.records).toBeArray();
  });
});

describe("provider: checks", () => {
  const radarr = providers.find((p) => p.name === "@mantle/radarr/remote");
  invariant(radarr, "provider @mantle/radarr/remote not registered");
  const instance = radarr.createInstance({
    url: RADARR_URL,
    api_key: RADARR_API_KEY,
  });

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
