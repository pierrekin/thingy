import { tmpdir } from "os";
import { join } from "path";

/**
 * Publishes a release manifest entry to object storage.
 *
 * Manifest layout under manifest/:
 *   0-index.json       — latest RELEASES_IN_INDEX releases + metadata
 *   1-releases.json    — next RELEASES_PER_FILE releases
 *   2-releases.json    — and so on
 *
 * Required env vars:
 *   VERSION             — release version (e.g. "v0.3.0")
 *   CHECKSUMS_PATH      — path to checksums.txt
 *   S3_BUCKET           — bucket name
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_ENDPOINT_URL
 */

const RELEASES_IN_INDEX = 50;
const RELEASES_PER_FILE = 100;
const INDEX_KEY = "manifest/0-index.json";

const ARTIFACT_META: Record<string, { platform: string; arch: string }> = {
  "mantle-linux-x86_64": { platform: "Linux", arch: "x64" },
  "mantle-linux-aarch64": { platform: "Linux", arch: "arm64" },
  "mantle-linux-x86_64-musl": { platform: "Linux (musl)", arch: "x64" },
  "mantle-linux-aarch64-musl": { platform: "Linux (musl)", arch: "arm64" },
  "mantle-darwin-x86_64": { platform: "macOS", arch: "x64" },
  "mantle-darwin-aarch64": { platform: "macOS", arch: "arm64" },
};

type Artifact = {
  platform: string;
  arch: string;
  filename: string;
  checksum: string;
};

type Release = {
  version: string;
  date: string;
  notes: string[];
  artifacts: Artifact[];
};

type Index = {
  latest: string;
  total: number;
  // current fileCount file number (1-indexed, 0 = none yet)
  fileCount: number;
  releases: Release[];
};

type ReleaseFile = {
  releases: Release[];
};

async function storageGet(bucket: string, key: string): Promise<string | null> {
  const tmp = join(tmpdir(), "manifest.json");
  const proc = Bun.spawn(["aws", "s3", "cp", `s3://${bucket}/${key}`, tmp], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exit, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
  ]);
  if (exit !== 0) {
    if (stderr.includes("does not exist")) return null;
    throw new Error(`Failed to fetch ${key}: ${stderr.trim()}`);
  }
  const content = await Bun.file(tmp).text();
  await Bun.spawn(["rm", "-f", tmp]).exited;
  return content;
}

async function storagePut(
  bucket: string,
  key: string,
  body: string,
): Promise<void> {
  const tmp = join(tmpdir(), "manifest.json");
  await Bun.write(tmp, body);
  const proc = Bun.spawn(["aws", "s3", "cp", tmp, `s3://${bucket}/${key}`], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exit = await proc.exited;
  await Bun.spawn(["rm", "-f", tmp]).exited;
  if (exit !== 0) throw new Error(`Failed to upload ${key}`);
}

function parseChecksums(text: string): Artifact[] {
  const artifacts: Artifact[] = [];
  for (const line of text.trim().split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const checksum = parts[0]!;
    const filename = parts[1]!;
    const meta = ARTIFACT_META[filename];
    if (!meta) continue;
    artifacts.push({ ...meta, filename, checksum });
  }
  return artifacts;
}

async function main() {
  const rawVersion = process.env.VERSION;
  const checksumsPath = process.env.CHECKSUMS_PATH;
  const bucket = process.env.S3_BUCKET;

  if (!rawVersion) throw new Error("VERSION env var required");
  if (!checksumsPath) throw new Error("CHECKSUMS_PATH env var required");
  if (!bucket) throw new Error("S3_BUCKET env var required");

  const version = rawVersion.replace(/^v/, "");

  const checksumsText = await Bun.file(checksumsPath).text();
  const artifacts = parseChecksums(checksumsText);

  if (artifacts.length === 0) {
    throw new Error("No recognised artifacts found in checksums file");
  }

  const newRelease: Release = {
    version,
    date: new Date().toISOString().split("T")[0]!,
    notes: ["placeholder"],
    artifacts,
  };

  const indexContent = await storageGet(bucket, INDEX_KEY);
  const index: Index = indexContent
    ? (JSON.parse(indexContent) as Index)
    : { latest: version, total: 0, fileCount: 0, releases: [] };

  index.releases.unshift(newRelease);
  index.total += 1;
  index.latest = version;

  // Drain overflow from the index into the current release file.
  // In practice this runs at most once per release.
  while (index.releases.length > RELEASES_IN_INDEX) {
    const overflow = index.releases.pop()!;

    if (index.fileCount === 0) {
      index.fileCount = 1;
    }

    const releaseFileKey = `manifest/${index.fileCount}-releases.json`;
    const releaseFileContent = await storageGet(bucket, releaseFileKey);
    const releaseFile: ReleaseFile = releaseFileContent
      ? (JSON.parse(releaseFileContent) as ReleaseFile)
      : { releases: [] };

    releaseFile.releases.push(overflow);
    await storagePut(bucket, releaseFileKey, JSON.stringify(releaseFile, null, 2));

    if (releaseFile.releases.length >= RELEASES_PER_FILE) {
      index.fileCount += 1;
    }
  }

  await storagePut(bucket, INDEX_KEY, JSON.stringify(index, null, 2));

  console.log(`Published release ${version} (total: ${index.total}, release files: ${index.fileCount})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
