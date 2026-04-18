import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "whisparr-v2",
  compose: "./compose.yml",
  tests: "./whisparr-v2.test.ts",
  compat: "../../compatibility/whisparr-v2",
});
