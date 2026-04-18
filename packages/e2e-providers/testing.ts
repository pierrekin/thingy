import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { invariant, spawn } from "mantle-framework";

export type RunnerConfig = {
  name: string;
  compose: string;
  tests: string;
  compat: string;
};

type VersionEntry = { tag: string; softwareVersion: string };
type Target = {
  image: string;
  imageSource: string;
  softwareSource: string;
  versions: VersionEntry[];
};
type VersionResult = {
  entry: VersionEntry;
  digest: string;
  passed: boolean;
  output: string;
  dockerOutput: string;
  testOutput: string;
};

const activeComposeDirs = new Set<string>();
let signalHandlerInstalled = false;

function installSignalHandler(): void {
  if (signalHandlerInstalled) return;
  signalHandlerInstalled = true;
  const handler = (signal: NodeJS.Signals) => {
    for (const dir of activeComposeDirs) {
      Bun.spawnSync(
        ["docker", "compose", "--progress=plain", "down", "--volumes"],
        { cwd: dir, stdout: "ignore", stderr: "ignore" },
      );
    }
    activeComposeDirs.clear();
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error(`Could not find package root from ${startDir}`);
    dir = parent;
  }
}

async function drain(
  readable: ReadableStream<Uint8Array>,
  live = false,
): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const reader = readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    if (live) process.stdout.write(text);
    chunks.push(text);
  }
  return chunks.join("").trimEnd();
}

async function collect(
  proc: {
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
  },
  live = false,
): Promise<string> {
  const [out, err] = await Promise.all([
    drain(proc.stdout, live),
    drain(proc.stderr, live),
  ]);
  return [out, err].filter(Boolean).join("\n");
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
  onRetry: (attempt: number, err: unknown) => void,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      onRetry(i, err);
      await Bun.sleep(baseDelayMs * 4 ** (i - 1));
    }
  }
  throw lastErr;
}

async function resolveDigest(image: string, tag: string): Promise<string> {
  const ref = `${image}:${tag}`;
  const proc = spawn(
    [
      "docker",
      "buildx",
      "imagetools",
      "inspect",
      ref,
      "--format",
      "{{.Manifest.Digest}}",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  invariant(
    code === 0,
    `failed to resolve digest for ${ref} (exit ${code}): ${err.trim()}`,
  );
  const digest = out.trim();
  invariant(
    digest.startsWith("sha256:"),
    `unexpected digest format for ${ref}: ${digest}`,
  );
  return digest;
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
  const dockerLines: string[] = [];
  const logDocker = (s: string) => {
    if (s) dockerLines.push(s);
  };
  const digest = await withRetry(
    () => resolveDigest(target.image, entry.tag),
    3,
    2000,
    (attempt, err) =>
      logDocker(
        `resolveDigest attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
  );
  const env = {
    ...process.env,
    TARGET_IMAGE: target.image,
    TARGET_VERSION: `${entry.tag}@${digest}`,
  };
  let testOutput = "";
  let passed = false;

  installSignalHandler();
  activeComposeDirs.add(composeDir);

  try {
    await withRetry(
      async () => {
        const pull = spawn(
          ["docker", "compose", "--progress=plain", "pull"],
          { cwd: composeDir, stdout: "pipe", stderr: "pipe", env },
        );
        logDocker(await collect(pull));
        if ((await pull.exited) !== 0) throw new Error("compose pull failed");
      },
      3,
      2000,
      (attempt) => logDocker(`compose pull attempt ${attempt} failed, retrying`),
    );

    const up = spawn(
      [
        "docker",
        "compose",
        "--progress=plain",
        "up",
        "-d",
        "--wait",
        "--pull=never",
      ],
      {
        cwd: composeDir,
        stdout: "pipe",
        stderr: "pipe",
        env,
      },
    );
    logDocker(await collect(up));
    if ((await up.exited) !== 0) throw new Error("compose up failed");

    // Wait for any one-shot containers labeled mantle.wait=true
    const ps = spawn(["docker", "compose", "ps", "-a", "--format", "json"], {
      cwd: composeDir,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    const psOut = await new Response(ps.stdout).text();
    await ps.exited;
    const containers = psOut
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    for (const c of containers) {
      if (c.Labels?.includes("mantle.wait=true")) {
        const wait = spawn(["docker", "wait", c.Name], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const code = (await new Response(wait.stdout).text()).trim();
        await wait.exited;
        if (code !== "0")
          throw new Error(`${c.Service} exited with code ${code}`);
      }
    }

    const test = spawn(["bun", "test", testFile], {
      cwd: packageRoot,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    testOutput = await collect(test, process.stdout.isTTY === true);
    passed = (await test.exited) === 0;
  } catch (err) {
    logDocker(err instanceof Error ? err.message : String(err));
  } finally {
    const down = spawn(
      ["docker", "compose", "--progress=plain", "down", "--volumes"],
      {
        cwd: composeDir,
        stdout: "pipe",
        stderr: "pipe",
        env,
      },
    );
    logDocker(await collect(down));
    await down.exited;
    const rmi = spawn(
      ["docker", "rmi", "--force", `${target.image}@${digest}`],
      { stdout: "pipe", stderr: "pipe" },
    );
    logDocker(await collect(rmi));
    await rmi.exited;
    activeComposeDirs.delete(composeDir);
  }

  const dockerOutput = dockerLines.join("\n");
  const output = [dockerOutput, testOutput].filter(Boolean).join("\n");
  return { entry, digest, passed, output, dockerOutput, testOutput };
}

export async function createRunner(
  meta: ImportMeta,
  config: RunnerConfig,
): Promise<void> {
  const baseDir = meta.dirname;
  const packageRoot = findPackageRoot(baseDir);
  const compatDir = resolve(baseDir, config.compat);
  const targetPath = join(compatDir, "target.json");
  const target: Target = JSON.parse(readFileSync(targetPath, "utf8"));
  const { version: providerVersion } = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  );

  const rawArgs = Bun.argv.slice(2);
  const record = rawArgs.includes("--record");
  const positional = rawArgs.filter((a) => !a.startsWith("-"));
  const command = positional[0];
  const target_arg = positional[1];

  if (command !== "test" && command !== "lint") {
    console.error(
      `Usage: bun run run.ts <test [--record] <latest|all|missing|<version>>|lint>`,
    );
    process.exit(1);
  }

  if (command === "lint") {
    const missing = target.versions.filter(
      (v) => !existsSync(join(compatDir, `${v.softwareVersion}.json`)),
    );
    for (const v of missing) {
      console.error(`MISSING  ${config.name}@${v.softwareVersion}`);
    }
    if (missing.length > 0) process.exit(1);
    console.log(`OK  ${config.name}`);
    return;
  }

  if (!target_arg) {
    console.error(
      `Usage: bun run run.ts test [--record] <latest|all|missing|<version>>`,
    );
    process.exit(1);
  }

  if (target_arg === "missing" && !record) {
    console.error(`'missing' is only valid with --record`);
    process.exit(1);
  }

  let entries: VersionEntry[];

  if (record && target_arg === "missing") {
    entries = target.versions.filter(
      (v) => !existsSync(join(compatDir, `${v.softwareVersion}.json`)),
    );
    if (entries.length === 0) {
      console.log(`OK  ${config.name}: all versions recorded`);
      return;
    }
  } else if (target_arg === "all") {
    if (target.versions.length === 0) {
      console.log(`SKIP  ${config.name}: no versions in target.json`);
      return;
    }
    entries = target.versions;
  } else if (target_arg === "latest") {
    const last = target.versions.at(-1);
    if (!last) {
      console.log(`SKIP  ${config.name}: no versions in target.json`);
      return;
    }
    entries = [last];
  } else {
    const entry = target.versions.find(
      (v) => v.tag === target_arg || v.softwareVersion === target_arg,
    );
    if (!entry) {
      console.error(`Version "${target_arg}" not found in target.json`);
      process.exit(1);
    }
    entries = [entry];
  }

  const results: VersionResult[] = [];

  for (const entry of entries) {
    const isTTY = process.stdout.isTTY === true;
    const header = `\n--- ${config.name}@${entry.softwareVersion} (${entry.tag}) ---`;
    if (isTTY) console.log(header);
    const result = await runVersion(
      config,
      baseDir,
      packageRoot,
      target,
      entry,
    );
    if (!isTTY) {
      console.log(
        result.testOutput ? `${header}\n${result.testOutput}` : header,
      );
    }
    if (!result.passed && result.dockerOutput) {
      console.log(result.dockerOutput);
    }
    results.push(result);

    if (result.passed && record) {
      const record = {
        provider: config.name,
        providerVersion,
        image: target.image,
        imageTag: entry.tag,
        imageDigest: result.digest,
        softwareVersion: entry.softwareVersion,
        testedAt: new Date().toISOString(),
        log: result.output,
      };
      mkdirSync(compatDir, { recursive: true });
      writeFileSync(
        join(compatDir, `${entry.softwareVersion}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
      );
      console.log(`PASS  ${config.name}@${entry.softwareVersion} → recorded`);
    } else if (!result.passed) {
      console.error(`FAIL  ${config.name}@${entry.softwareVersion}`);
    }
  }

  if (results.some((r) => !r.passed)) process.exit(1);
}
