import type { Provider } from "./provider.ts";
import proxmox from "provider-proxmox";
import restic from "provider-restic";
import shell from "provider-shell";

const providers: Record<string, Provider> = {
	proxmox,
	restic,
	shell,
};

export function getProvider(name: string): Provider | undefined {
	return providers[name];
}

export function getAllProviders(): Provider[] {
	return Object.values(providers);
}
