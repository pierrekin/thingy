import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "sonarr",
  compose: "./compose.yml",
  tests: "./sonarr.test.ts",
  compat: "../../compatibility/sonarr",
});
