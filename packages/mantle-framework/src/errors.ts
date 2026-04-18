export class OperationalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalError";
  }
}

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

/**
 * Assert a contract holds. Use when an external system (sqlite, OS,
 * filesystem) has promised a condition and we want to crash with context
 * if that promise is broken.
 */
export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}
