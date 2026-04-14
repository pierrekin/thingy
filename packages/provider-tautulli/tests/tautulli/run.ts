import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "tautulli",
  compose: "./compose.yml",
  tests: "./tautulli.test.ts",
  compat: "../../compatibility/tautulli",
});
