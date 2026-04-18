import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "sonarr",
  compose: "./compose.yml",
  tests: "./sonarr.test.ts",
  compat: "../../compatibility/sonarr",
});
