export type ProxmoxClientConfig = {
  url: string;
  tokenId: string;
  tokenSecret: string;
};

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
    const res = await fetch(url, {
      headers: {
        Authorization: `PVEAPIToken=${this.config.tokenId}=${this.config.tokenSecret}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Proxmox API error ${res.status}: ${text}`);
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
  }> {
    return this.request(`/api2/json/nodes/${node}/qemu/${vmId}/status/current`);
  }

  async getLxcStatus(node: string, vmId: number): Promise<{
    status: string;
    name: string;
    vmid: number;
  }> {
    return this.request(`/api2/json/nodes/${node}/lxc/${vmId}/status/current`);
  }

  async getNodeStatus(node: string): Promise<{
    // Node status returns lots of data, we just care it responds
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
