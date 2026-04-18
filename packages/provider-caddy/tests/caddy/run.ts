import { createRunner } from "e2e-providers/testing";

await createRunner(import.meta, {
  name: "caddy",
  compose: "./compose.yml",
  tests: "./caddy.test.ts",
  compat: "../../compatibility/caddy",
});
