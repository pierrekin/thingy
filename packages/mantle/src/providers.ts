import type { Provider } from "./provider.ts";
import proxmox from "provider-proxmox";

const providers: Record<string, Provider> = {
	proxmox,
};

export function getProvider(name: string): Provider | undefined {
	return providers[name];
}

export function getAllProviders(): Provider[] {
	return Object.values(providers);
}
