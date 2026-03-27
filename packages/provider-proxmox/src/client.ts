export type ProxmoxClientConfig = {
  url: string;
  tokenId: string;
  tokenSecret: string;
};

export class ProxmoxApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ProxmoxApiError";
  }
}

export type VmStatus = {
  vmid: number;
  name: string;
  status: string; // "running" | "stopped" | etc
  node: string;
};

export type NodeStatus = {
  node: string;
  status: string; // "online" | "offline"
};

export class ProxmoxClient {
  constructor(private config: ProxmoxClientConfig) {}

  private async request<T>(path: string): Promise<T> {
    const url = `${this.config.url}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ProxmoxApiError("unreachable", `Failed to connect to Proxmox: ${message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new ProxmoxApiError("auth_failed", `Proxmox authentication failed: ${text}`, res.status);
      }
      throw new ProxmoxApiError("api_error", `Proxmox API error ${res.status}: ${text}`, res.status);
    }

    const json = await res.json();
    return json.data as T;
  }

  async getClusterResources(type?: string): Promise<Array<{
    id: string;
    type: string;
    vmid?: number;
    node: string;
    name?: string;
    status: string;
  }>> {
    const query = type ? `?type=${type}` : "";
    return this.request(`/api2/json/cluster/resources${query}`);
  }

  async getVmStatus(node: string, vmId: number): Promise<{
    status: string;
    name: string;
    vmid: number;
    cpu: number;      // CPU usage as decimal (0.0 to ~N for N cores)
    cpus: number;     // Number of CPUs allocated
    mem: number;      // Current memory usage in bytes
    maxmem: number;   // Max memory allocated in bytes
  }> {
    return this.request(`/api2/json/nodes/${node}/qemu/${vmId}/status/current`);
  }

  async getLxcStatus(node: string, vmId: number): Promise<{
    status: string;
    name: string;
    vmid: number;
    cpu: number;      // CPU usage as decimal
    cpus: number;     // Number of CPUs allocated
    mem: number;      // Current memory usage in bytes
    maxmem: number;   // Max memory allocated in bytes
  }> {
    return this.request(`/api2/json/nodes/${node}/lxc/${vmId}/status/current`);
  }

  async getNodeStatus(node: string): Promise<{
    cpu: number;      // CPU usage as decimal
    cpuinfo: { cpus: number };  // CPU info with core count
    memory: {
      used: number;   // Used memory in bytes
      total: number;  // Total memory in bytes
    };
  }> {
    return this.request(`/api2/json/nodes/${node}/status`);
  }

  /**
   * Find which node a VM/LXC is on by querying cluster resources.
   */
  async findVmNode(vmId: number, type: "qemu" | "lxc" = "qemu"): Promise<string | null> {
    const resources = await this.getClusterResources("vm");
    const vm = resources.find(
      (r) => r.vmid === vmId && r.type === type
    );
    return vm?.node ?? null;
  }
}
