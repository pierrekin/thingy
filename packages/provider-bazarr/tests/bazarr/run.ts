import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "bazarr",
  compose: "./compose.yml",
  tests: "./bazarr.test.ts",
  compat: "../../compatibility/bazarr",
});
