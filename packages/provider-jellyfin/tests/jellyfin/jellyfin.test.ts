import { beforeAll, describe, expect, test } from "bun:test";
import { invariant } from "mantle-framework";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const JELLYFIN_URL = process.env.JELLYFIN_URL ?? "http://localhost:8096";
const JELLYFIN_USER = "admin";
const JELLYFIN_PASSWORD = "e2etestpassword123";

let token: string;

beforeAll(async () => {
  const res = await fetch(`${JELLYFIN_URL}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        'MediaBrowser Client="mantle-e2e", Device="e2e", DeviceId="mantle-e2e-test", Version="1.0.0"',
    },
    body: JSON.stringify({ Username: JELLYFIN_USER, Pw: JELLYFIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Authentication failed: ${res.status}`);
  const data = (await res.json()) as { AccessToken: string };
  token = data.AccessToken;
});

describe("smoke: api", () => {
  test("ping is reachable without auth", async () => {
    const res = await fetch(`${JELLYFIN_URL}/System/Ping`);
    expect(res.ok).toBe(true);
  });

  test("system info is reachable with token", async () => {
    const res = await fetch(`${JELLYFIN_URL}/System/Info`, {
      headers: { "X-Emby-Token": token },
    });
    expect(res.ok).toBe(true);
  });
});

describe("provider: checks", () => {
  test("health.sessions returns a non-negative count", async () => {
    const jellyfin = providers.find(
      (p) => p.name === "@mantle/jellyfin/remote",
    );
    invariant(jellyfin, "provider @mantle/jellyfin/remote not registered");
    const instance = jellyfin.createInstance({
      url: JELLYFIN_URL,
      api_key: token,
    });
    const [result] = await instance.check({ type: "health" }, ["sessions"]);
    expect(expectSuccess(result, "sessions")).toBeGreaterThanOrEqual(0);
  });
});
