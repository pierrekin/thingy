import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "prowlarr",
  compose: "./compose.yml",
  tests: "./prowlarr.test.ts",
  compat: "../../compatibility/prowlarr",
});
