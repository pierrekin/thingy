# Concepts

Mantle monitors infrastructure by running **checks** against **targets** from **providers**.

## Core Model

```
Provider → Target → Check → Result
```

**Provider**: A system that exposes targets (Proxmox, AWS, Kubernetes, etc.). You configure connection credentials once per provider.

**Target**: A thing you want to monitor (a VM, a node, a container). Each target belongs to a provider and has a type.

**Check**: A specific assertion about a target's state. Each target type has built-in checks (e.g., "VM should be running"). Checks run on an interval.

**Agent**: The process that runs checks and reports results. An agent has a name and a list of targets to monitor.

## How It Works

1. Agent starts and connects to configured providers
2. For each target, agent runs the enabled checks on their configured intervals
3. Check results are reported (pass/fail with details)
4. Repeat

## Configuration Hierarchy

Checks and intervals can be configured at multiple levels. More specific config wins:

```
Target > Provider > Built-in Default
```

This lets you set sensible defaults at the provider level and override per-target when needed.
