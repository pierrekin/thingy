import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "mylarr",
  compose: "./compose.yml",
  tests: "./mylarr.test.ts",
  compat: "../../compatibility/mylarr",
});
