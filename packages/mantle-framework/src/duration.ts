import { z } from "zod";

const UNITS = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type Unit = keyof typeof UNITS;

function isUnit(u: string | undefined): u is Unit {
  return u === "ms" || u === "s" || u === "m" || u === "h" || u === "d";
}

/**
 * Parse a duration string like "30s", "5m", "1.5h", "2d" into milliseconds.
 * Supported units: ms, s, m, h, d. Decimal values are allowed.
 */
export function parseDuration(s: string): number {
  const match = s.match(/^(?<value>\d+(?:\.\d+)?)\s*(?<unit>ms|s|m|h|d)$/i);
  const value = match?.groups?.value;
  const unit = match?.groups?.unit?.toLowerCase();
  if (!value || !isUnit(unit)) {
    throw new Error(
      `Invalid duration: "${s}". Expected e.g. "30s", "5m", "1.5h", "2d".`,
    );
  }
  return Math.floor(parseFloat(value) * UNITS[unit]);
}

/**
 * Zod schema for duration strings. Parses into milliseconds.
 * Use in config schemas: `timeout: duration.optional()`.
 */
export const duration = z.string().transform((s, ctx) => {
  try {
    return parseDuration(s);
  } catch (err) {
    ctx.addIssue({
      code: "custom",
      message: err instanceof Error ? err.message : String(err),
    });
    return z.NEVER;
  }
});
