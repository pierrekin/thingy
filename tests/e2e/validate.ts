import { readdirSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const PROVIDERS_DIR = join(import.meta.dirname, "providers");

const target = Bun.argv[2];
if (!target) {
  console.error("Usage: bun run test:e2e:validate <provider>@<version>");
  console.error("Example: bun run test:e2e:validate sonarr@4.0.9.2244-ls249");
  process.exit(1);
}

const match = target.match(/^([a-z0-9-]+)@([^\s]+)$/);
if (!match) {
  console.error(`Invalid target format: "${target}" — expected <provider>@<version>, e.g. sonarr@4.0.9.2244-ls249`);
  process.exit(1);
}

const [, provider, version] = match as [string, string, string];

const providerDir = join(PROVIDERS_DIR, provider);
const exists = readdirSync(PROVIDERS_DIR, { withFileTypes: true })
  .some((d) => d.isDirectory() && d.name === provider);

if (!exists) {
  console.error(`No provider found: "${provider}"`);
  process.exit(1);
}

const targetPath = join(providerDir, "compatibility", "target.json");
const targetJson = JSON.parse(require("fs").readFileSync(targetPath, "utf8")) as { image: string; versions: string[] };

console.log(`Validating ${provider}@${version} (${targetJson.image}:${version})`);

const lines: string[] = [];
const log = (s: string) => lines.push(s);

async function collect(proc: ReturnType<typeof Bun.spawn>): Promise<void> {
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (out.trim()) log(out.trimEnd());
  if (err.trim()) log(err.trimEnd());
}

const env = { ...process.env, TARGET_IMAGE: targetJson.image, TARGET_VERSION: version };
let passed = false;

try {
  const up = Bun.spawn(["docker", "compose", "up", "-d", "--wait"], {
    cwd: providerDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  await collect(up);
  if ((await up.exited) !== 0) throw new Error("compose up failed");

  const test = Bun.spawn(["bun", "test"], {
    cwd: providerDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  await collect(test);
  passed = (await test.exited) === 0;
} catch (err) {
  log(err instanceof Error ? err.message : String(err));
} finally {
  const down = Bun.spawn(["docker", "compose", "down", "--volumes"], {
    cwd: providerDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  await collect(down);
  await down.exited;
}

console.log(lines.join("\n"));

if (!passed) {
  console.error(`\nFAIL  ${provider}@${version} — compatibility record not written`);
  process.exit(1);
}

const record = {
  provider,
  version,
  image: targetJson.image,
  testedAt: new Date().toISOString(),
  result: "pass" as const,
};

const compatDir = join(providerDir, "compatibility");
const file = join(compatDir, `${version}.json`);
writeFileSync(file, JSON.stringify(record, null, 2) + "\n");

if (!targetJson.versions.includes(version)) {
  targetJson.versions.push(version);
  writeFileSync(targetPath, JSON.stringify(targetJson, null, 2) + "\n");
}

console.log(`\nPASS  ${provider}@${version} → ${file}`);
