import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { providers } from "./providers.ts";

const target = Bun.argv[2];
if (!target) {
  console.error("Usage: bun run validate <provider>@<version>");
  console.error("Example: bun run validate sonarr@4.0.17");
  process.exit(1);
}

const match = target.match(/^([a-z0-9-]+)@([^\s]+)$/);
if (!match) {
  console.error(`Invalid target format: "${target}" — expected <provider>@<version>`);
  process.exit(1);
}

const [, name, version] = match as [string, string, string];

const provider = providers.find((p) => p.name === name);
if (!provider) {
  console.error(`No provider found: "${name}"`);
  process.exit(1);
}

type Target = { image: string; versions: string[] };
const targetJson: Target = JSON.parse(readFileSync(join(provider.compatDir, "target.json"), "utf8"));

console.log(`Validating ${name}@${version} (${targetJson.image}:${version})`);

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
    cwd: provider.testDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  await collect(up);
  if ((await up.exited) !== 0) throw new Error("compose up failed");

  const test = Bun.spawn(["bun", "test"], {
    cwd: provider.testDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  await collect(test);
  passed = (await test.exited) === 0;
} catch (err) {
  log(err instanceof Error ? err.message : String(err));
} finally {
  const down = Bun.spawn(["docker", "compose", "down", "--volumes", "--rmi", "all"], {
    cwd: provider.testDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  await collect(down);
  await down.exited;
}

console.log(lines.join("\n"));

if (!passed) {
  console.error(`\nFAIL  ${name}@${version} — compatibility record not written`);
  process.exit(1);
}

const record = {
  provider: name,
  version,
  image: targetJson.image,
  testedAt: new Date().toISOString(),
  result: "pass" as const,
};

mkdirSync(provider.compatDir, { recursive: true });
const file = join(provider.compatDir, `${version}.json`);
writeFileSync(file, JSON.stringify(record, null, 2) + "\n");

if (!targetJson.versions.includes(version)) {
  targetJson.versions.push(version);
  writeFileSync(join(provider.compatDir, "target.json"), JSON.stringify(targetJson, null, 2) + "\n");
}

console.log(`\nPASS  ${name}@${version} → ${file}`);
