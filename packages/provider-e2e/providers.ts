import { join } from "path";

const PACKAGES = join(import.meta.dirname, "..");

export type Provider = {
  name: string;
  packageDir: string;
  script: string;
};

export const providers: Provider[] = [
  { name: "sonarr",   packageDir: join(PACKAGES, "provider-servarr"), script: "test:e2e:sonarr" },
  { name: "radarr",   packageDir: join(PACKAGES, "provider-servarr"), script: "test:e2e:radarr" },
  { name: "lidarr",   packageDir: join(PACKAGES, "provider-servarr"), script: "test:e2e:lidarr" },
  { name: "prowlarr", packageDir: join(PACKAGES, "provider-servarr"), script: "test:e2e:prowlarr" },
  { name: "whisparr",    packageDir: join(PACKAGES, "provider-servarr"), script: "test:e2e:whisparr" },
  { name: "whisparr-v2", packageDir: join(PACKAGES, "provider-servarr"), script: "test:e2e:whisparr-v2" },
  { name: "mylarr",   packageDir: join(PACKAGES, "provider-mylarr"),  script: "test:e2e:mylarr" },
  { name: "bazarr",   packageDir: join(PACKAGES, "provider-bazarr"),  script: "test:e2e:bazarr" },
];
