import { OperationalError } from "mantle-framework";

export function handleOperationalErrors<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof OperationalError) {
        console.error(err.message);
        process.exit(1);
      }
      throw err;
    }
  };
}
