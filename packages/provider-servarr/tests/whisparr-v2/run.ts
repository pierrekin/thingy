import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "whisparr-v2",
  compose: "./compose.yml",
  tests: "./whisparr-v2.test.ts",
  compat: "../../compatibility/whisparr-v2",
});
