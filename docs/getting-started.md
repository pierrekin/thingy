# Getting Started

## Install

```bash
# TODO: add install instructions
```

## Configure

Copy the minimal example and edit it:

```bash
cp examples/01-minimal.yaml config.yaml
```

Fill in your provider credentials and target details:

```yaml
providers:
  proxmox:
    url: https://your-proxmox-host:8006
    tokenId: your-token-id
    tokenSecret: your-token-secret

agent:
  name: my-agent
  targets:
    - name: my-vm
      provider: proxmox
      type: vm
      vmId: 100
```

## Run

```bash
# TODO: add run command
```

You should see check results for your configured targets.

## Next Steps

- See [concepts.md](concepts.md) for the mental model
- See [configuration.md](configuration.md) for all config options
- See `examples/` for progressively complex configurations
