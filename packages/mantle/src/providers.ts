import type { Provider } from "./provider.ts";
import proxmox from "provider-proxmox";
import restic from "provider-restic";

const providers: Record<string, Provider> = {
	proxmox,
	restic,
};

export function getProvider(name: string): Provider | undefined {
	return providers[name];
}

export function getAllProviders(): Provider[] {
	return Object.values(providers);
}
