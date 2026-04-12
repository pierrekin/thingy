import { join } from "path";

const semver = process.argv[2];

if (!semver) {
  const pkg = JSON.parse(
    await Bun.file(
      join(import.meta.dir, "../packages/mantle/package.json"),
    ).text(),
  );
  console.log(pkg.version);
  console.log(`hint: bun run version <version>`);
  process.exit(0);
}

const tag = `v${semver}`;

if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._-]+)?$/.test(semver)) {
  console.error(`Invalid version '${semver}' (must be X.Y.Z or X.Y.Z-suffix)`);
  process.exit(1);
}

const root = join(import.meta.dir, "..");

const existingTag = Bun.spawnSync(["git", "-C", root, "tag", "-l", tag]);
if (existingTag.stdout.toString().trim() === tag) {
  console.error(`Tag ${tag} already exists`);
  process.exit(1);
}

const dirty = Bun.spawnSync(["git", "-C", root, "status", "--porcelain"]);
if (dirty.exitCode !== 0 || dirty.stdout.toString().trim().length > 0) {
  console.error(
    "Working directory is dirty: commit or stash changes before versioning",
  );
  process.exit(1);
}

const packageJsonPath = join(root, "packages", "mantle", "package.json");

const pkg = JSON.parse(await Bun.file(packageJsonPath).text());
pkg.version = semver;
await Bun.write(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

const addResult = Bun.spawnSync(["git", "-C", root, "add", packageJsonPath]);
if (addResult.exitCode !== 0) {
  console.error("git add failed");
  process.exit(1);
}

const commitResult = Bun.spawnSync(
  ["git", "-C", root, "commit", "-m", `release ${tag}`],
  { stdout: "inherit", stderr: "inherit" },
);
if (commitResult.exitCode !== 0) {
  console.error("git commit failed");
  process.exit(1);
}

const tagResult = Bun.spawnSync(["git", "-C", root, "tag", tag], {
  stdout: "inherit",
  stderr: "inherit",
});
if (tagResult.exitCode !== 0) {
  console.error("git tag failed");
  process.exit(1);
}

console.log(`Tagged ${tag}, push with:`);
console.log(`  git push && git push origin ${tag}`);
