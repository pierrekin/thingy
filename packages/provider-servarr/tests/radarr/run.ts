import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "radarr",
  compose: "./compose.yml",
  tests: "./radarr.test.ts",
  compat: "../../compatibility/radarr",
});
