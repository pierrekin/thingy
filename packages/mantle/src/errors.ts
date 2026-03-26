export class OperationalError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OperationalError";
	}
}

export function handleOperationalErrors<
	T extends { args: Record<string, unknown> },
>(fn: (ctx: T) => Promise<void>) {
	return async (ctx: T) => {
		try {
			await fn(ctx);
		} catch (err) {
			if (err instanceof OperationalError) {
				console.error(err.message);
				process.exit(1);
			}
			throw err;
		}
	};
}
