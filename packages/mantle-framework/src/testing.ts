import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";

export type RunnerConfig = {
  name: string;
  compose: string;
  tests: string;
  compat: string;
};

type VersionEntry = { tag: string; softwareVersion: string };
type Target = { image: string; imageSource: string; softwareSource: string; versions: VersionEntry[] };
type VersionResult = { entry: VersionEntry; passed: boolean; output: string };

function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find package root from ${startDir}`);
    dir = parent;
  }
}

async function drain(readable: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!readable) return "";
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const reader = readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    if (process.stdout.isTTY) process.stdout.write(text);
    chunks.push(text);
  }
  return chunks.join("").trimEnd();
}

async function collect(proc: ReturnType<typeof Bun.spawn>): Promise<string> {
  const [out, err] = await Promise.all([drain(proc.stdout), drain(proc.stderr)]);
  return [out, err].filter(Boolean).join("\n");
}

async function getImageDigest(image: string, tag: string): Promise<string | null> {
  const proc = Bun.spawn(
    ["docker", "inspect", "--format", "{{index .RepoDigests 0}}", `${image}:${tag}`],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const str = out.trim();
  return str.includes("@") ? str.split("@")[1]! : null;
}

async function runVersion(
  config: RunnerConfig,
  baseDir: string,
  packageRoot: string,
  target: Target,
  entry: VersionEntry,
): Promise<VersionResult> {
  const composeDir = resolve(baseDir, dirname(config.compose));
  const testFile = resolve(baseDir, config.tests);
  const env = { ...process.env, TARGET_IMAGE: target.image, TARGET_VERSION: entry.tag };
  const lines: string[] = [];
  const log = (s: string) => { if (s) lines.push(s); };
  let passed = false;

  try {
    const up = Bun.spawn(["docker", "compose", "up", "-d", "--wait"], {
      cwd: composeDir, stdout: "pipe", stderr: "pipe", env,
    });
    log(await collect(up));
    if ((await up.exited) !== 0) throw new Error("compose up failed");

    const test = Bun.spawn(["bun", "test", testFile], {
      cwd: packageRoot, stdout: "pipe", stderr: "pipe", env,
    });
    log(await collect(test));
    passed = (await test.exited) === 0;
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
  } finally {
    const down = Bun.spawn(["docker", "compose", "down", "--volumes"], {
      cwd: composeDir, stdout: "pipe", stderr: "pipe", env,
    });
    log(await collect(down));
    await down.exited;
  }

  return { entry, passed, output: lines.join("\n") };
}

export async function createRunner(meta: ImportMeta, config: RunnerConfig): Promise<void> {
  const baseDir = meta.dirname;
  const packageRoot = findPackageRoot(baseDir);
  const compatDir = resolve(baseDir, config.compat);
  const targetPath = join(compatDir, "target.json");
  const target: Target = JSON.parse(readFileSync(targetPath, "utf8"));
  const { version: providerVersion } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

  const rawArgs = Bun.argv.slice(2);
  const record = rawArgs.includes("--record");
  const positional = rawArgs.filter(a => !a.startsWith("-"));
  const command = positional[0];
  const target_arg = positional[1];

  if (command !== "test" || !target_arg) {
    console.error(`Usage: bun run run.ts test [--record] <latest|all|missing|<version>>`);
    process.exit(1);
  }

  if (target_arg === "missing" && !record) {
    console.error(`'missing' is only valid with --record`);
    process.exit(1);
  }

  let entries: VersionEntry[];

  if (record && target_arg === "missing") {
    entries = target.versions.filter(v => !existsSync(join(compatDir, `${v.softwareVersion}.json`)));
    if (entries.length === 0) { console.log(`OK  ${config.name}: all versions recorded`); return; }
  } else if (target_arg === "all") {
    if (target.versions.length === 0) { console.log(`SKIP  ${config.name}: no versions in target.json`); return; }
    entries = target.versions;
  } else if (target_arg === "latest") {
    if (target.versions.length === 0) { console.log(`SKIP  ${config.name}: no versions in target.json`); return; }
    entries = [target.versions[target.versions.length - 1]!];
  } else {
    const entry = target.versions.find(v => v.tag === target_arg || v.softwareVersion === target_arg);
    if (!entry) { console.error(`Version "${target_arg}" not found in target.json`); process.exit(1); }
    entries = [entry];
  }

  const results: VersionResult[] = [];

  for (const entry of entries) {
    const result = await runVersion(config, baseDir, packageRoot, target, entry);
    if (process.stdout.isTTY) {
      console.log(`\n--- ${config.name}@${entry.softwareVersion} (${entry.tag}) ---`);
    } else {
      console.log(`\n--- ${config.name}@${entry.softwareVersion} (${entry.tag}) ---\n${result.output}`);
    }
    results.push(result);

    if (result.passed && record) {
      const imageDigest = await getImageDigest(target.image, entry.tag);
      const record = {
        provider: config.name,
        providerVersion,
        image: target.image,
        imageTag: entry.tag,
        imageDigest,
        softwareVersion: entry.softwareVersion,
        testedAt: new Date().toISOString(),
        log: result.output,
      };
      mkdirSync(compatDir, { recursive: true });
      writeFileSync(join(compatDir, `${entry.softwareVersion}.json`), JSON.stringify(record, null, 2) + "\n");
      console.log(`PASS  ${config.name}@${entry.softwareVersion} → recorded`);
    } else if (!result.passed) {
      console.error(`FAIL  ${config.name}@${entry.softwareVersion}`);
    }
  }

  if (results.some((r) => !r.passed)) process.exit(1);
}
