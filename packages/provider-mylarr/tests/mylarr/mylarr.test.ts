import { describe, test, expect } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const MYLARR_URL = process.env.MYLARR_URL ?? "http://localhost:8090";
const MYLARR_API_KEY = process.env.MYLARR_API_KEY ?? "e2etestapikeyfortesting123456789";

async function mylarrGet<T>(cmd: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${MYLARR_URL}/api/`);
  url.searchParams.set("apikey", MYLARR_API_KEY);
  url.searchParams.set("cmd", cmd);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mylarr cmd=${cmd} returned ${res.status}`);
  return res.json() as Promise<T>;
}

describe("smoke: api", () => {
  test("getVersion returns success with version info", async () => {
    const result = await mylarrGet<{ success: boolean; data: { current_version: string } }>("getVersion");
    expect(result.success).toBe(true);
    expect(result.data.current_version).toBeString();
    expect(result.data.current_version.length).toBeGreaterThan(0);
  });

  test("getIndex returns success with an array of comics", async () => {
    const result = await mylarrGet<{ success: boolean; data: unknown[] }>("getIndex");
    expect(result.success).toBe(true);
    expect(result.data).toBeArray();
  });

  test("getWanted returns an object with issues array", async () => {
    const result = await mylarrGet<{ issues: unknown[] }>("getWanted");
    expect(result.issues).toBeArray();
  });

  test("wrong API key returns success=false with auth error", async () => {
    const url = new URL(`${MYLARR_URL}/api/`);
    url.searchParams.set("apikey", "wrongkeyfortestingpurposes12345");
    url.searchParams.set("cmd", "getVersion");
    const res = await fetch(url.toString());
    expect(res.ok).toBe(true);
    const body = await res.json() as { success: boolean; error?: { message: string } };
    expect(body.success).toBe(false);
    expect(body.error?.message).toInclude("API key");
  });
});

describe("provider: checks", () => {
  const mylarr = providers.find((p) => p.name === "@mantle/mylarr/remote")!;
  const instance = mylarr.createInstance!({ url: MYLARR_URL, api_key: MYLARR_API_KEY });

  test("wanted.count returns a non-negative count", async () => {
    const [result] = await instance.check({ type: "wanted" }, ["count"]);
    expect(expectSuccess(result, "count")).toBeGreaterThanOrEqual(0);
  });
});
