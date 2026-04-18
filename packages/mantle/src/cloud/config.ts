const DEFAULT_CLOUD_URL = "https://getmantle.sh";

export function getCloudUrl(): string {
  return process.env.MANTLE_CLOUD_URL ?? DEFAULT_CLOUD_URL;
}
