# Configuration

## Structure

```yaml
providers:
  <instance-name>:
    type: <provider-type>  # optional if instance name equals type
    # provider-specific credentials
    interval: <duration>
    intervals:
      <target-type>: <duration>
    checks:
      <target-type>:
        <check-name>: <check-value>

agent:
  name: <agent-name>
  interval: <duration>
  targets:
    - name: <target-name>
      provider: <instance-name>
      type: <target-type>
      interval: <duration>
      # target-type-specific fields
      checks:
        <check-name>: <check-value>
```

## Providers

Single instance (key is the type):

```yaml
providers:
  proxmox:
    url: https://proxmox.example.com:8006
    tokenId: "..."
    tokenSecret: "..."
```

Multiple instances (explicit `type` field):

```yaml
providers:
  proxmox-prod:
    type: proxmox
    url: https://prod.example.com:8006
  proxmox-staging:
    type: proxmox
    url: https://staging.example.com:8006
```

## Check Values

| Value | Meaning |
|-------|---------|
| `__disabled__` | Check will not run |
| `__enabled__` | Use built-in default config |
| `{ ... }` | Custom config |
| *(omitted)* | Use provider default, or built-in default |

## Resolution Order

Checks and intervals resolve in this order (first defined wins):

1. Target config
2. Provider config (per target-type for intervals)
3. Provider config (global for intervals)
4. Agent config (intervals only)
5. Built-in default

## Examples

See `examples/` for complete configurations:

- `01-minimal.yaml` - single provider, single target
- `02-basic.yaml` - single provider, multiple targets
- `03-custom-checks.yaml` - override check defaults
- `04-multi-provider.yaml` - multiple provider instances
- `05-full-featured.yaml` - all options demonstrated
