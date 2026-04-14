export function expectSuccess(result: unknown, check: string): number {
  const r = result as { check: string; value?: number; error?: unknown };
  if (r.error !== undefined) throw new Error(`Check "${check}" returned an error: ${JSON.stringify(r.error)}`);
  if (typeof r.value !== "number") throw new Error(`Check "${check}" value is not a number: ${JSON.stringify(r)}`);
  return r.value;
}
