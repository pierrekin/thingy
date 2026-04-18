import { basename, join } from "node:path";
import { providers } from "./providers.ts";

const rawArgs = Bun.argv.slice(2);
const record = rawArgs.includes("--record");
const dirty = rawArgs.includes("--dirty");
const packagesArg = rawArgs
  .find((a) => a.startsWith("--packages="))
  ?.split("=")[1];
const positional = rawArgs.filter((a) => !a.startsWith("-"));
const [command, ...rest] = positional;

const ALL_PACKAGES = ["mantle-framework", "provider-e2e"];

async function isDirty(dir: string): Promise<boolean> {
  const proc = Bun.spawn(["git", "diff", "--quiet", "--", dir], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await proc.exited) !== 0;
}

function filterByPackages(packages: string[]): typeof providers {
  if (packages.some((p) => ALL_PACKAGES.includes(p))) return providers;
  return providers.filter((p) => packages.includes(basename(p.packageDir)));
}

async function filterProviders() {
  let selected = providers;
  if (packagesArg) {
    selected = filterByPackages(packagesArg.split(","));
  }
  if (dirty) {
    const filtered = [];
    for (const p of selected) {
      const dir = join(p.packageDir, "compatibility", p.name);
      if (await isDirty(dir)) filtered.push(p);
    }
    return filtered;
  }
  return selected;
}

if (
  command !== "test" &&
  command !== "lint" &&
  command !== "discover" &&
  command !== "pr" &&
  command !== "issue"
) {
  console.error("Usage: bun run run.ts <test|lint|discover|pr|issue>");
  process.exit(1);
}

if (command === "test") {
  const target = rest[0];
  if (!target) {
    console.error(
      "Usage: bun run run.ts test [--record] <latest|all|missing|<version>>",
    );
    process.exit(1);
  }
  if (target === "missing" && !record) {
    console.error("'missing' is only valid with --record");
    process.exit(1);
  }
}

async function drain(
  readable: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!readable) return;
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
  }
}

const CONCURRENCY = 4;

async function pool<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  async function worker() {
    while (true) {
      const item = queue.shift();
      if (item === undefined) break;
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

if (command === "test" || command === "lint") {
  const selected = await filterProviders();
  if (selected.length === 0) {
    console.log("No providers to run.");
    process.exit(0);
  }

  // Forward args without --dirty (subprocesses don't need it)
  const forwardArgs = rawArgs.filter((a) => a !== "--dirty");

  if (command === "lint") {
    async function lintOne(
      provider: (typeof providers)[number],
    ): Promise<{ name: string; passed: boolean; output: string }> {
      const proc = Bun.spawn(["bun", "run", provider.script, ...forwardArgs], {
        cwd: provider.packageDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const passed = (await proc.exited) === 0;
      return {
        name: provider.name,
        passed,
        output: `${stdout}${stderr}`,
      };
    }

    const start = performance.now();
    const results: { name: string; passed: boolean; output: string }[] = [];
    await pool(
      selected,
      async (p) => results.push(await lintOne(p)),
      CONCURRENCY,
    );
    const elapsed = Math.round(performance.now() - start);

    const failures = results.filter((r) => !r.passed);
    if (failures.length === 0) {
      console.log(`Checked ${results.length} providers in ${elapsed}ms.`);
      process.exit(0);
    }

    for (const { name, output } of failures) {
      console.log(`FAIL  ${name}`);
      if (output.trim()) console.log(output.trimEnd());
    }
    console.log(
      `Checked ${results.length} providers in ${elapsed}ms. ${failures.length} failed.`,
    );
    process.exit(1);
  }

  const description = `test${record ? " --record" : ""} ${rest[0]}`;
  console.log(
    `Running e2e (${description}) for: ${selected.map((p) => p.name).join(", ")}`,
  );

  async function run(
    provider: (typeof providers)[number],
  ): Promise<{ name: string; passed: boolean }> {
    console.log(`START ${provider.name}`);
    const proc = Bun.spawn(["bun", "run", provider.script, ...forwardArgs], {
      cwd: provider.packageDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await Promise.all([drain(proc.stdout), drain(proc.stderr)]);
    const passed = (await proc.exited) === 0;
    return { name: provider.name, passed };
  }

  const results: { name: string; passed: boolean }[] = [];
  await pool(selected, async (p) => results.push(await run(p)), CONCURRENCY);

  console.log("\n=== Results ===");
  for (const { name, passed } of results) {
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  }
  if (results.some((r) => !r.passed)) process.exit(1);
}

if (command === "discover") {
  const discoverScript = join(import.meta.dirname, "discover.sh");
  const discoverArgs = rawArgs.slice(1); // everything after "discover"

  // Build list of compatibility dirs that have discover.json
  const targets: { name: string; dir: string }[] = [];
  for (const provider of providers) {
    const dir = join(provider.packageDir, "compatibility", provider.name);
    const discoverJson = Bun.file(join(dir, "discover.json"));
    if (await discoverJson.exists()) {
      targets.push({ name: provider.name, dir });
    }
  }

  if (targets.length === 0) {
    console.error("No providers with discover.json found.");
    process.exit(1);
  }

  console.log(
    `Discovering versions for: ${targets.map((t) => t.name).join(", ")}`,
  );

  async function collect(
    readable: ReadableStream<Uint8Array> | null,
  ): Promise<string> {
    if (!readable) return "";
    return new Response(readable).text();
  }

  async function discover(target: {
    name: string;
    dir: string;
  }): Promise<{ name: string; passed: boolean }> {
    console.log(`START  ${target.name}`);

    const proc = Bun.spawn([discoverScript, target.dir, ...discoverArgs], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      collect(proc.stdout),
      collect(proc.stderr),
    ]);
    const passed = (await proc.exited) === 0;

    const label = passed ? "PASS" : "FAIL";
    console.log(`${label}   ${target.name}`);
    if (stdout.trim()) console.log(stdout.trimEnd());
    if (stderr.trim()) console.error(stderr.trimEnd());

    return { name: target.name, passed };
  }

  const results: { name: string; passed: boolean }[] = [];
  await pool(
    targets,
    async (t) => results.push(await discover(t)),
    CONCURRENCY,
  );

  console.log("\n=== Summary ===");
  for (const { name, passed } of results) {
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  }

  if (results.some((r) => !r.passed)) process.exit(1);
}

if (command === "pr") {
  const prScript = join(import.meta.dirname, "pr.sh");

  async function collect(
    readable: ReadableStream<Uint8Array> | null,
  ): Promise<string> {
    if (!readable) return "";
    return new Response(readable).text();
  }

  console.log(`Checking PRs for: ${providers.map((p) => p.name).join(", ")}`);

  let failed = false;
  for (const provider of providers) {
    const dir = join(provider.packageDir, "compatibility", provider.name);
    console.log(`START  ${provider.name}`);

    const proc = Bun.spawn([prScript, provider.name, dir], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      collect(proc.stdout),
      collect(proc.stderr),
    ]);
    const passed = (await proc.exited) === 0;
    if (!passed) failed = true;

    const label = passed ? "PASS" : "FAIL";
    console.log(`${label}   ${provider.name}`);
    if (stdout.trim()) console.log(stdout.trimEnd());
    if (stderr.trim()) console.error(stderr.trimEnd());
  }

  if (failed) process.exit(1);
}

if (command === "issue") {
  const issueScript = join(import.meta.dirname, "issue.sh");

  async function collect(
    readable: ReadableStream<Uint8Array> | null,
  ): Promise<string> {
    if (!readable) return "";
    return new Response(readable).text();
  }

  console.log(
    `Checking issues for: ${providers.map((p) => p.name).join(", ")}`,
  );

  let failed = false;
  for (const provider of providers) {
    const dir = join(provider.packageDir, "compatibility", provider.name);
    console.log(`START  ${provider.name}`);

    const proc = Bun.spawn([issueScript, provider.name, dir], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      collect(proc.stdout),
      collect(proc.stderr),
    ]);
    const passed = (await proc.exited) === 0;
    if (!passed) failed = true;

    const label = passed ? "PASS" : "FAIL";
    console.log(`${label}   ${provider.name}`);
    if (stdout.trim()) console.log(stdout.trimEnd());
    if (stderr.trim()) console.error(stderr.trimEnd());
  }

  if (failed) process.exit(1);
}
