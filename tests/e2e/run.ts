import { readdirSync } from "fs";
import { join } from "path";

const PROVIDERS_DIR = join(import.meta.dirname, "providers");
const filter = Bun.argv[2];

const providers = readdirSync(PROVIDERS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => !filter || name === filter);

if (providers.length === 0) {
  console.error(filter ? `No provider found: ${filter}` : "No providers found");
  process.exit(1);
}

async function run(provider: string): Promise<{ provider: string; passed: boolean }> {
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

  let passed = false;

  try {
    const up = Bun.spawn(["docker", "compose", "up", "-d", "--wait"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await collect(up);
    if ((await up.exited) !== 0) throw new Error("compose up failed");

    const test = Bun.spawn(["bun", "test"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
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
    });
    await collect(down);
    await down.exited;
  }

  console.log(`\n=== ${provider} ===`);
  console.log(lines.join("\n"));

  return { provider, passed };
}

console.log(`Running e2e tests for: ${providers.join(", ")}`);

const results = await Promise.all(providers.map(run));

console.log("\n=== Results ===");
for (const { provider, passed } of results) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${provider}`);
}

if (results.some((r) => !r.passed)) process.exit(1);
