import type { Provider } from "mantle-framework";
import { providers as proxmoxProviders } from "provider-proxmox";
import { providers as resticProviders } from "provider-restic";
import { providers as shellProviders } from "provider-shell";
import { providers as servarrProviders } from "provider-servarr";
import { providers as mylarrProviders } from "provider-mylarr";
import { providers as bazarrProviders } from "provider-bazarr";
import { providers as jellyfinProviders } from "provider-jellyfin";
import { providers as tautulliProviders } from "provider-tautulli";
import { providers as nzbhydra2Providers } from "provider-nzbhydra2";
import { providers as caddyProviders } from "provider-caddy";

const allProviders = [...proxmoxProviders, ...resticProviders, ...shellProviders, ...servarrProviders, ...mylarrProviders, ...bazarrProviders, ...jellyfinProviders, ...tautulliProviders, ...nzbhydra2Providers, ...caddyProviders];

const registry: Record<string, Provider> = Object.fromEntries(
	allProviders.map((p) => [p.name, p]),
);

export function getProvider(name: string): Provider | undefined {
	return registry[name];
}

export function getAllProviders(): Provider[] {
	return allProviders;
}
