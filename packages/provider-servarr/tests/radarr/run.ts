import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "radarr",
  compose: "./compose.yml",
  tests: "./radarr.test.ts",
  compat: "../../compatibility/radarr",
});
