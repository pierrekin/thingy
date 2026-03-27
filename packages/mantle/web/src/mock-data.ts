export type Event = {
	id: number;
	code: string;
	message: string;
	startTime: Date;
	endTime: Date | null;
};

export type SlotStatus = "green" | "red" | "grey" | null;

export type StatusSlot = {
	start: number;
	end: number;
	status: SlotStatus;
};

export type Check = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export type Target = {
	name: string;
	provider: string;
	statusSlots: StatusSlot[];
	events: Event[];
	checks: Check[];
};

export type Provider = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export type Channel = {
	name: string;
	statusSlots: StatusSlot[];
	events: Event[];
};

export type Hub = {
	name: string;
	providers: Provider[];
	channels: Channel[];
	targets: Target[];
};

// Generate 12 slots of 5 minutes each for the last hour
const now = Date.now();
const SLOT_MINUTES = 5;
const SLOT_COUNT = 12;

function generateSlots(statuses: SlotStatus[]): StatusSlot[] {
	const slots: StatusSlot[] = [];
	for (let i = 0; i < SLOT_COUNT; i++) {
		const end = now - i * SLOT_MINUTES * 60 * 1000;
		const start = end - SLOT_MINUTES * 60 * 1000;
		slots.unshift({
			start,
			end,
			status: statuses[SLOT_COUNT - 1 - i] ?? "green",
		});
	}
	return slots;
}

const hour = (h: number, m: number) => {
	const d = new Date(now);
	d.setHours(h, m, 0, 0);
	return d;
};

// g = green, r = red, x = grey
const g: SlotStatus = "green";
const r: SlotStatus = "red";
const x: SlotStatus = "grey";

export const mockHub: Hub = {
	name: "Home Lab",
	providers: [
		{
			name: "proxmox",
			statusSlots: generateSlots([g, g, r, r, g, g, g, g, g, g, g, g]),
			events: [
				{ id: 1, code: "auth_failed", message: "Authentication failed", startTime: hour(14, 10), endTime: hour(14, 15) },
			],
		},
		{
			name: "cloudflare",
			statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]),
			events: [],
		},
	],
	channels: [
		{
			name: "slack",
			statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]),
			events: [],
		},
		{
			name: "email",
			statusSlots: generateSlots([g, r, r, g, g, g, g, g, g, g, g, g]),
			events: [
				{ id: 2, code: "smtp_error", message: "SMTP connection refused", startTime: hour(13, 45), endTime: hour(13, 50) },
			],
		},
	],
	targets: [
		{
			name: "infra-truenas",
			provider: "proxmox",
			statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, r, r, r]),
			events: [],
			checks: [
				{
					name: "state",
					statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]),
					events: [],
				},
				{
					name: "cpu",
					statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]),
					events: [],
				},
				{
					name: "memory",
					statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, r, r, r]),
					events: [
						{ id: 3, code: "memory:max", message: "100.6 max 90", startTime: hour(14, 32), endTime: null },
					],
				},
			],
		},
		{
			name: "infra-backups",
			provider: "proxmox",
			statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]),
			events: [],
			checks: [
				{ name: "state", statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]), events: [] },
				{ name: "cpu", statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]), events: [] },
				{ name: "memory", statusSlots: generateSlots([g, g, g, g, g, g, g, g, g, g, g, g]), events: [] },
			],
		},
		{
			name: "hst-gateway",
			provider: "proxmox",
			statusSlots: generateSlots([g, g, g, g, r, r, x, x, r, g, g, g]),
			events: [
				{ id: 4, code: "vm_not_found", message: "VM 105 not found", startTime: hour(14, 0), endTime: hour(14, 5) },
			],
			checks: [
				{ name: "state", statusSlots: generateSlots([g, g, g, g, r, r, g, g, g, g, g, g]), events: [] },
				{
					name: "cpu",
					statusSlots: generateSlots([g, g, g, g, x, x, g, g, r, g, g, g]),
					events: [
						{ id: 5, code: "cpu:max", message: "95.2 max 80", startTime: hour(14, 20), endTime: hour(14, 25) },
					],
				},
				{ name: "memory", statusSlots: generateSlots([g, g, g, g, x, x, g, g, g, g, g, g]), events: [] },
			],
		},
	],
};
