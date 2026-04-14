import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "whisparr",
  compose: "./compose.yml",
  tests: "./whisparr.test.ts",
  compat: "../../compatibility/whisparr",
});
