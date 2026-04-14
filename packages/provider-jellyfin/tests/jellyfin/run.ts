import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "jellyfin",
  compose: "./compose.yml",
  tests: "./jellyfin.test.ts",
  compat: "../../compatibility/jellyfin",
});
