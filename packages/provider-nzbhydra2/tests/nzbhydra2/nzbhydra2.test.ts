import { describe, test, expect } from "bun:test";
import { providers } from "../../src/index.ts";
import { expectSuccess } from "../helpers.ts";

const NZBHYDRA2_URL = process.env.NZBHYDRA2_URL ?? "http://localhost:5076";
const NZBHYDRA2_API_KEY = process.env.NZBHYDRA2_API_KEY ?? "442HS2R934QOGQBGIII34TRK2P";

describe("smoke: api", () => {
	test("stats/indexers responds successfully", async () => {
		const res = await fetch(`${NZBHYDRA2_URL}/api/stats/indexers`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apikey: NZBHYDRA2_API_KEY }),
		});
		expect(res.ok).toBe(true);
		const json = await res.json();
		expect(Array.isArray(json)).toBe(true);
	});
});

describe("provider: checks", () => {
	const nzbhydra2 = providers.find((p) => p.name === "@mantle/nzbhydra2/remote")!;
	const instance = nzbhydra2.createInstance!({ url: NZBHYDRA2_URL, api_key: NZBHYDRA2_API_KEY });

	test("instance.total_searches returns a non-negative count", async () => {
		const [result] = await instance.check({ type: "instance" }, ["total_searches"]);
		expect(expectSuccess(result, "total_searches")).toBeGreaterThanOrEqual(0);
	});

	test("instance.total_downloads returns a non-negative count", async () => {
		const [result] = await instance.check({ type: "instance" }, ["total_downloads"]);
		expect(expectSuccess(result, "total_downloads")).toBeGreaterThanOrEqual(0);
	});

	test("instance.enabled_indexers returns a non-negative count", async () => {
		const [result] = await instance.check({ type: "instance" }, ["enabled_indexers"]);
		expect(expectSuccess(result, "enabled_indexers")).toBeGreaterThanOrEqual(0);
	});

	test("instance.disabled_indexers returns a non-negative count", async () => {
		const [result] = await instance.check({ type: "instance" }, ["disabled_indexers"]);
		expect(expectSuccess(result, "disabled_indexers")).toBeGreaterThanOrEqual(0);
	});
});
