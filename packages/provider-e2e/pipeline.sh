#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pipeline.sh [--limit N]
#
# End-to-end pipeline for all providers:
#   1. Discover and write new versions to target.json
#   2. Test all unverified versions
#   3. Create PRs for passes, issues for failures

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Step 1: Discover and write new versions
echo "=== Step 1: Discover ==="
bun run "$SCRIPT_DIR/run.ts" discover write "$@"

# Step 2: Test unverified versions
echo "=== Step 2: Test ==="
bun run "$SCRIPT_DIR/run.ts" test --record missing

# Step 3: Create PRs for passes
echo "=== Step 3: PRs ==="
bun run "$SCRIPT_DIR/run.ts" pr

# Step 4: Create issues for failures
echo "=== Step 4: Issues ==="
# TODO: bun run "$SCRIPT_DIR/run.ts" issue
