import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "whisparr",
  compose: "./compose.yml",
  tests: "./whisparr.test.ts",
  compat: "../../compatibility/whisparr",
});
