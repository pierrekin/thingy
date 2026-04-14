import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "nzbhydra2",
  compose: "./compose.yml",
  tests: "./nzbhydra2.test.ts",
  compat: "../../compatibility/nzbhydra2",
});
