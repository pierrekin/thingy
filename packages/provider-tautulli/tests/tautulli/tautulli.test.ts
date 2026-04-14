import { describe, test, expect } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const TAUTULLI_URL = process.env.TAUTULLI_URL ?? "http://localhost:8181";
const TAUTULLI_API_KEY = process.env.TAUTULLI_API_KEY ?? "e2etestapikeyfortautulli01234567";

describe("smoke: api", () => {
	test("get_activity responds successfully", async () => {
		const res = await fetch(`${TAUTULLI_URL}/api/v2?apikey=${TAUTULLI_API_KEY}&cmd=get_activity`);
		expect(res.ok).toBe(true);
		const json = await res.json() as { response: { result: string } };
		expect(json.response.result).toBe("success");
	});
});

describe("provider: checks", () => {
	const tautulli = providers.find((p) => p.name === "@mantle/tautulli/remote")!;
	const instance = tautulli.createInstance!({ url: TAUTULLI_URL, api_key: TAUTULLI_API_KEY });

	test("activity.streams returns a non-negative count", async () => {
		const [result] = await instance.check({ type: "activity" }, ["streams"]);
		expect(expectSuccess(result, "streams")).toBeGreaterThanOrEqual(0);
	});

	test("history.plays returns a non-negative count", async () => {
		const [result] = await instance.check({ type: "history" }, ["plays"]);
		expect(expectSuccess(result, "plays")).toBeGreaterThanOrEqual(0);
	});
});
