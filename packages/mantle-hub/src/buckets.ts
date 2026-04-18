export type BucketConfig = {
  count: number;
  durationMs: number;
};

export function getBucketBounds(
  time: Date,
  config: BucketConfig,
): { start: number; end: number } {
  const timeMs = time.getTime();
  const bucketStart =
    Math.floor(timeMs / config.durationMs) * config.durationMs;
  const bucketEnd = bucketStart + config.durationMs;
  return { start: bucketStart, end: bucketEnd };
}

export function getTimeRangeBounds(config: BucketConfig): {
  start: number;
  end: number;
} {
  const now = Date.now();
  const currentBucketStart =
    Math.floor(now / config.durationMs) * config.durationMs;
  const currentBucketEnd = currentBucketStart + config.durationMs;
  const rangeStart = currentBucketEnd - config.count * config.durationMs;
  return { start: rangeStart, end: currentBucketEnd };
}

// Default: 12 buckets of 5 minutes each = 1 hour
export const DEFAULT_BUCKET_CONFIG: BucketConfig = {
  count: 12,
  durationMs: 5 * 60 * 1000,
};
