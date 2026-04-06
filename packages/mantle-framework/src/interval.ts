/**
 * Parse an interval string like "30s", "5m", "1h" into milliseconds.
 */
export function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid interval format: ${interval}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown interval unit: ${unit}`);
  }
}
