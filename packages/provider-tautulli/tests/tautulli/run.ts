import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "tautulli",
  compose: "./compose.yml",
  tests: "./tautulli.test.ts",
  compat: "../../compatibility/tautulli",
});
