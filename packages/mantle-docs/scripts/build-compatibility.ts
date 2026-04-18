import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = join(import.meta.dirname, "../..");
const PROVIDERS_OUT_DIR = join(
  import.meta.dirname,
  "../dist/compatibility/providers",
);

mkdirSync(PROVIDERS_OUT_DIR, { recursive: true });

type CompatRecord = {
  provider: string;
  providerVersion: string | null;
  image: string;
  imageTag: string;
  imageDigest: string | null;
  softwareVersion: string;
  testedAt: string;
  log: string | null;
};

type TargetJson = {
  image: string;
  imageSource: string;
  softwareSource: string;
};

type ProviderCompat = {
  name: string;
  image: string;
  imageSource: string;
  softwareSource: string;
  versions: CompatRecord[];
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

    const target = JSON.parse(readFileSync(targetPath, "utf8")) as TargetJson;

    const versions: CompatRecord[] = readdirSync(appDir)
      .filter((f) => f.endsWith(".json") && f !== "target.json")
      .map(
        (f) =>
          JSON.parse(readFileSync(join(appDir, f), "utf8")) as CompatRecord,
      )
      .sort((a, b) => a.testedAt.localeCompare(b.testedAt));

    const output: ProviderCompat = {
      name: appEntry.name,
      image: target.image,
      imageSource: target.imageSource,
      softwareSource: target.softwareSource,
      versions,
    };

    const outFile = join(PROVIDERS_OUT_DIR, `${appEntry.name}.json`);
    writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`  ${appEntry.name} → ${versions.length} version(s)`);
  }
}

console.log("Done.");
