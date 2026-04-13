import type { Provider } from "mantle-framework";
import { providers as proxmoxProviders } from "provider-proxmox";
import { providers as resticProviders } from "provider-restic";
import { providers as shellProviders } from "provider-shell";

const allProviders = [...proxmoxProviders, ...resticProviders, ...shellProviders];

const registry: Record<string, Provider> = Object.fromEntries(
	allProviders.map((p) => [p.name, p]),
);

export function getProvider(name: string): Provider | undefined {
	return registry[name];
}

export function getAllProviders(): Provider[] {
	return allProviders;
}
