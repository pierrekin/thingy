import { describe, expect, test } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const LIDARR_URL = process.env.LIDARR_URL ?? "http://localhost:8686";
const LIDARR_API_KEY =
  process.env.LIDARR_API_KEY ?? "e2etestapikeyfortesting12345678";

async function lidarrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${LIDARR_URL}${path}`, {
    headers: { "X-Api-Key": LIDARR_API_KEY },
  });
  if (!res.ok) throw new Error(`Lidarr ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

describe("smoke: api", () => {
  test("ping is reachable without auth", async () => {
    const res = await fetch(`${LIDARR_URL}/ping`);
    expect(res.ok).toBe(true);
  });

  test("system/status returns a version string", async () => {
    const status = await lidarrGet<{ version: string }>(
      "/api/v1/system/status",
    );
    expect(status.version).toBeString();
    expect(status.version.length).toBeGreaterThan(0);
  });

  test("health returns an array of items with expected shape", async () => {
    const health =
      await lidarrGet<{ source: string; type: string; message: string }[]>(
        "/api/v1/health",
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
      await lidarrGet<{ freeSpace: number; totalSpace: number }[]>(
        "/api/v1/diskspace",
      );
    expect(disks).toBeArray();
    expect(disks.length).toBeGreaterThan(0);
    for (const disk of disks) {
      expect(disk.freeSpace).toBeNumber();
      expect(disk.totalSpace).toBeGreaterThan(0);
    }
  });

  test("queue returns totalRecords and records array", async () => {
    const queue = await lidarrGet<{ totalRecords: number; records: unknown[] }>(
      "/api/v1/queue",
    );
    expect(queue.totalRecords).toBeNumber();
    expect(queue.records).toBeArray();
  });
});

describe("provider: checks", () => {
  const lidarr = providers.find((p) => p.name === "@mantle/lidarr/remote")!;
  const instance = lidarr.createInstance?.({
    url: LIDARR_URL,
    api_key: LIDARR_API_KEY,
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
