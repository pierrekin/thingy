import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "mylarr",
  compose: "./compose.yml",
  tests: "./mylarr.test.ts",
  compat: "../../compatibility/mylarr",
});
