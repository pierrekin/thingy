import { describe, expect, test } from "bun:test";
import { invariant } from "mantle-framework";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const CADDY_URL = process.env.CADDY_URL ?? "http://localhost:2019";
const CADDY_PROXY_HEALTHY =
  process.env.CADDY_PROXY_HEALTHY ?? "http://localhost:8080";
const CADDY_PROXY_DEAD =
  process.env.CADDY_PROXY_DEAD ?? "http://localhost:8081";
const CADDY_PROXY_SLOW =
  process.env.CADDY_PROXY_SLOW ?? "http://localhost:8082";

describe("smoke: api", () => {
  test("admin /config/ responds successfully", async () => {
    const res = await fetch(`${CADDY_URL}/config/`);
    expect(res.ok).toBe(true);
  });

  test("admin /metrics responds successfully", async () => {
    const res = await fetch(`${CADDY_URL}/metrics`);
    expect(res.ok).toBe(true);
  });

  test("admin /reverse_proxy/upstreams responds successfully", async () => {
    const res = await fetch(`${CADDY_URL}/reverse_proxy/upstreams`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as unknown[];
    expect(Array.isArray(json)).toBe(true);
  });
});

describe("provider: checks", () => {
  const caddy = providers.find((p) => p.name === "@mantle/caddy/remote");
  invariant(caddy, "provider @mantle/caddy/remote not registered");
  const instance = caddy.createInstance({ url: CADDY_URL });

  test("server.config_reload_success returns 1", async () => {
    const [result] = await instance.check({ type: "server" }, [
      "config_reload_success",
    ]);
    expect(expectSuccess(result, "config_reload_success")).toBe(1);
  });

  test("upstream(healthy).fails is 0 and num_requests is 0 at idle", async () => {
    const results = await instance.check(
      { type: "upstream", address: "upstream:80" },
      ["num_requests", "fails"],
    );
    expect(expectSuccess(results[0], "num_requests")).toBe(0);
    expect(expectSuccess(results[1], "fails")).toBe(0);
  });

  test("upstream(healthy).fails stays 0 after successful requests", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(CADDY_PROXY_HEALTHY);
      expect(res.ok).toBe(true);
    }
    const [result] = await instance.check(
      { type: "upstream", address: "upstream:80" },
      ["fails"],
    );
    expect(expectSuccess(result, "fails")).toBe(0);
  });

  test("upstream(slow).num_requests is 1 while in-flight, 0 after completion", async () => {
    const fetchPromise = fetch(CADDY_PROXY_SLOW);
    await Bun.sleep(500);
    const [inflight] = await instance.check(
      { type: "upstream", address: "slow-upstream:80" },
      ["num_requests"],
    );
    expect(expectSuccess(inflight, "num_requests")).toBe(1);
    await fetchPromise;
    const [done] = await instance.check(
      { type: "upstream", address: "slow-upstream:80" },
      ["num_requests"],
    );
    expect(expectSuccess(done, "num_requests")).toBe(0);
  }, 10_000);

  test("upstream(dead).fails increments after failed requests", async () => {
    for (let i = 0; i < 3; i++) {
      await fetch(CADDY_PROXY_DEAD);
    }
    const [result] = await instance.check(
      { type: "upstream", address: "127.0.0.1:9999" },
      ["fails"],
    );
    expect(expectSuccess(result, "fails")).toBeGreaterThan(0);
  });
});
