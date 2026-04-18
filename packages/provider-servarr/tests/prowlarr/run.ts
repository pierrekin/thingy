import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "prowlarr",
  compose: "./compose.yml",
  tests: "./prowlarr.test.ts",
  compat: "../../compatibility/prowlarr",
});
