import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "bazarr",
  compose: "./compose.yml",
  tests: "./bazarr.test.ts",
  compat: "../../compatibility/bazarr",
});
