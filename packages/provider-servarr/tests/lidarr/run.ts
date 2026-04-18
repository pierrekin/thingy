import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "lidarr",
  compose: "./compose.yml",
  tests: "./lidarr.test.ts",
  compat: "../../compatibility/lidarr",
});
