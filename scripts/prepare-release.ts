import { join } from "path";

const semver = process.argv[2];

if (!semver) {
  console.error("usage: bun run prepare-release <version>");
  process.exit(1);
}

if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._-]+)?$/.test(semver)) {
  console.error(`Invalid version '${semver}' (must be X.Y.Z or X.Y.Z-suffix)`);
  process.exit(1);
}

const root = join(import.meta.dir, "..");
const packageJsonPath = join(root, "packages", "mantle", "package.json");
const tag = `v${semver}`;
const branch = `release/${tag}`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function run(
  cmd: string[],
  opts: { inherit?: boolean } = {},
): { exitCode: number; stdout: string } {
  const result = Bun.spawnSync(cmd, {
    cwd: root,
    stdout: opts.inherit ? "inherit" : "pipe",
    stderr: opts.inherit ? "inherit" : "pipe",
  });
  return {
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout?.toString().trim() ?? "",
  };
}

if (run(["gh", "--version"]).exitCode !== 0) {
  fail("gh CLI is required but not installed");
}

if (run(["git", "tag", "-l", tag]).stdout === tag) {
  fail(`Tag ${tag} already exists`);
}

if (run(["git", "rev-parse", "--verify", "--quiet", branch]).exitCode === 0) {
  fail(`Branch ${branch} already exists locally`);
}

if (run(["git", "ls-remote", "--heads", "origin", branch]).stdout) {
  fail(`Branch ${branch} already exists on origin`);
}

const dirty = run(["git", "status", "--porcelain"]);
if (dirty.exitCode !== 0 || dirty.stdout.length > 0) {
  fail("Working directory is dirty: commit or stash changes before releasing");
}

if (run(["git", "fetch", "origin", "main"], { inherit: true }).exitCode !== 0) {
  fail("git fetch failed");
}

if (
  run(["git", "checkout", "-b", branch, "origin/main"], { inherit: true })
    .exitCode !== 0
) {
  fail("git checkout failed");
}

const isPrerelease = semver.includes("-");

const changelogsDir = join(root, "changelogs");
const nextPath = join(changelogsDir, "next.md");
const nextFile = Bun.file(nextPath);
if (!(await nextFile.exists())) {
  fail("changelogs/next.md is missing");
}
const changelogContent = (await nextFile.text()).trim();
if (!changelogContent || changelogContent === "placeholder") {
  fail("changelogs/next.md is invalid");
}

const pkg = JSON.parse(await Bun.file(packageJsonPath).text());
pkg.version = semver;
await Bun.write(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

const filesToStage = [packageJsonPath];

if (!isPrerelease) {
  const versionPath = join(changelogsDir, `${semver}.md`);
  await Bun.write(versionPath, changelogContent + "\n");
  await Bun.write(nextPath, "placeholder\n");
  filesToStage.push(versionPath, nextPath);
}

if (run(["git", "add", ...filesToStage]).exitCode !== 0) {
  fail("git add failed");
}

if (
  run(["git", "commit", "-m", `chore: release ${tag}`], { inherit: true })
    .exitCode !== 0
) {
  fail("git commit failed");
}

if (
  run(["git", "push", "-u", "origin", branch], { inherit: true }).exitCode !== 0
) {
  fail("git push failed");
}

const prBody = `${changelogContent}`;

const pr = Bun.spawnSync(
  [
    "gh",
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    `chore: release ${tag}`,
    "--body",
    prBody,
  ],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
if (pr.exitCode !== 0) {
  fail("gh pr create failed");
}
