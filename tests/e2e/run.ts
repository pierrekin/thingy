import { readdirSync } from "fs";
import { join } from "path";

const PROVIDERS_DIR = join(import.meta.dirname, "providers");

const args = Bun.argv.slice(2);
const all = args.includes("--all");
const filter = args.find((a) => !a.startsWith("--"));

type Target = { image: string; versions: string[] };

function readTarget(provider: string): Target {
  const path = join(PROVIDERS_DIR, provider, "compatibility", "target.json");
  return JSON.parse(require("fs").readFileSync(path, "utf8"));
}

const providers = readdirSync(PROVIDERS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => !filter || name === filter);

if (providers.length === 0) {
  console.error(filter ? `No provider found: ${filter}` : "No providers found");
  process.exit(1);
}

async function runVersion(
  provider: string,
  version: string,
  target: Target,
): Promise<{ provider: string; version: string; passed: boolean }> {
  const dir = join(PROVIDERS_DIR, provider);
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

  const env = { ...process.env, TARGET_IMAGE: target.image, TARGET_VERSION: version };
  let passed = false;

  try {
    const up = Bun.spawn(["docker", "compose", "up", "-d", "--wait"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    await collect(up);
    if ((await up.exited) !== 0) throw new Error("compose up failed");

    const test = Bun.spawn(["bun", "test"], {
      cwd: dir,
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
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    await collect(down);
    await down.exited;
  }

  console.log(`\n=== ${provider}@${version} ===`);
  console.log(lines.join("\n"));

  return { provider, version, passed };
}

async function runProvider(provider: string): Promise<{ provider: string; version: string; passed: boolean }[]> {
  const target = readTarget(provider);

  if (target.versions.length === 0) {
    console.log(`\n=== ${provider} ===`);
    console.log("SKIP  no versions declared in target.json");
    return [];
  }

  const versions = all ? target.versions : [target.versions[target.versions.length - 1]];

  const results: { provider: string; version: string; passed: boolean }[] = [];
  for (const version of versions) {
    results.push(await runVersion(provider, version, target));
  }
  return results;
}

const mode = all ? "all versions" : "latest";
console.log(`Running e2e tests (${mode}) for: ${providers.join(", ")}`);

const nested = await Promise.all(providers.map(runProvider));
const results = nested.flat();

console.log("\n=== Results ===");
for (const { provider, version, passed } of results) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${provider}@${version}`);
}

if (results.some((r) => !r.passed)) process.exit(1);
