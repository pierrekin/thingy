import { providers } from "./providers.ts";

const [command, arg] = Bun.argv.slice(2) as [string | undefined, string | undefined];

const validCommands: Record<string, string[]> = {
  check: ["latest", "all"],
  validate: ["missing", "all"],
};

if (!command || !validCommands[command] || (arg && !validCommands[command]!.includes(arg))) {
  console.error("Usage: bun run test:e2e <check latest|check all|validate missing|validate all>");
  process.exit(1);
}

if (!arg) {
  console.error("Usage: bun run test:e2e <check latest|check all|validate missing|validate all>");
  process.exit(1);
}

console.log(`Running e2e (${command} ${arg}) for: ${providers.map((p) => p.name).join(", ")}`);

async function drain(readable: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!readable) return;
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
  }
}

async function run(provider: typeof providers[number]): Promise<{ name: string; passed: boolean }> {
  console.log(`START ${provider.name}`);

  const proc = Bun.spawn(["bun", "run", provider.script, command!, arg!], {
    cwd: provider.packageDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  await Promise.all([drain(proc.stdout), drain(proc.stderr)]);
  const passed = (await proc.exited) === 0;

  return { name: provider.name, passed };
}

const CONCURRENCY = 4;

async function pool<T>(items: T[], fn: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  const queue = [...items];
  async function worker() {
    while (queue.length > 0) await fn(queue.shift()!);
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

const results: { name: string; passed: boolean }[] = [];
await pool(providers, async (p) => results.push(await run(p)), CONCURRENCY);

console.log("\n=== Results ===");
for (const { name, passed } of results) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
}

if (results.some((r) => !r.passed)) process.exit(1);
