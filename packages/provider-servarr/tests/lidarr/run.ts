import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "lidarr",
  compose: "./compose.yml",
  tests: "./lidarr.test.ts",
  compat: "../../compatibility/lidarr",
});
