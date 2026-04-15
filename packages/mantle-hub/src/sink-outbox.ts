export type SinkOutboxPayload = {
	time: number;
	provider: string;
	target: string;
	check: string;
	success: boolean;
	value: number | null;
	error: string | null;
	violation: string | null;
};
