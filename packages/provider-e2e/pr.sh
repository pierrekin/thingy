#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pr.sh <provider> <compatibility-dir>
#
# If the provider has uncommitted changes, creates a branch off main
# with just those changes, commits, pushes, and opens a PR.

provider="${1:?"Usage: pr.sh <provider> <compatibility-dir>"}"
dir="${2:?"Usage: pr.sh <provider> <compatibility-dir>"}"

# Check for uncommitted or untracked changes in this provider's dir
changed=$({ git diff --name-only -- "$dir"; git ls-files --others --exclude-standard -- "$dir"; } | sort -u)
if [[ -z "$changed" ]]; then
  echo "No changes for $provider" >&2
  exit 0
fi

# Extract new versions from the dirty target.json
new_versions=$(git diff -- "$dir/target.json" \
  | grep -E '^\+.*"softwareVersion"' \
  | sed -E 's/.*"softwareVersion": *"([^"]+)".*/\1/' \
  | sort -V)

if [[ -z "$new_versions" ]]; then
  echo "No new versions in target.json diff for $provider" >&2
  exit 0
fi

latest_version=$(echo "$new_versions" | tail -1)
branch_name="provider/$provider/$latest_version"

echo "Creating PR for $provider: $latest_version"

git checkout -b "$branch_name" main
git add $changed
git commit -m "feat(provider): add compatibility for $provider $latest_version"
git push -u origin "$branch_name"

gh pr create \
  --title "feat(provider): add compatibility for $provider $latest_version" \
  --body "$(cat <<EOF
Add compatibility verification for $provider:
$(echo "$new_versions" | sed 's/^/- /')
EOF
)"

git checkout -
