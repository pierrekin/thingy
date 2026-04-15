import { createRunner } from "mantle-framework/testing";

await createRunner(import.meta, {
  name: "caddy",
  compose: "./compose.yml",
  tests: "./caddy.test.ts",
  compat: "../../compatibility/caddy",
});
