import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

const PACKAGES_DIR = join(import.meta.dirname, "../..");
const OUT_DIR = join(import.meta.dirname, "../compatibility");

mkdirSync(OUT_DIR, { recursive: true });

type VersionRecord = {
  provider: string;
  version: string;
  image: string;
  testedAt: string;
  result: "pass";
};

type CompatOutput = {
  provider: string;
  image: string;
  versions: VersionRecord[];
};

for (const pkgEntry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!pkgEntry.isDirectory()) continue;
  const compatDir = join(PACKAGES_DIR, pkgEntry.name, "compatibility");
  if (!existsSync(compatDir)) continue;

  for (const appEntry of readdirSync(compatDir, { withFileTypes: true })) {
    if (!appEntry.isDirectory()) continue;
    const appDir = join(compatDir, appEntry.name);
    const targetPath = join(appDir, "target.json");
    if (!existsSync(targetPath)) continue;

    const target = JSON.parse(readFileSync(targetPath, "utf8")) as { image: string; versions: string[] };

    const versions: VersionRecord[] = readdirSync(appDir)
      .filter((f) => f.endsWith(".json") && f !== "target.json")
      .map((f) => JSON.parse(readFileSync(join(appDir, f), "utf8")) as VersionRecord)
      .sort((a, b) => a.testedAt.localeCompare(b.testedAt));

    const output: CompatOutput = {
      provider: appEntry.name,
      image: target.image,
      versions,
    };

    const outFile = join(OUT_DIR, `${appEntry.name}.json`);
    writeFileSync(outFile, JSON.stringify(output, null, 2) + "\n");
    console.log(`  ${appEntry.name} → ${versions.length} version(s)`);
  }
}

console.log("Done.");
