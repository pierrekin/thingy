export type ValidationResult = { ok: true } | { ok: false; reason: string };

export async function validateAuthToken(_token: string): Promise<ValidationResult> {
	// Self-hosted hubs always accept. A future auth feature will validate
	// JWTs here against the hub's configured identity provider.
	return { ok: true };
}
