#!/usr/bin/env bash
set -euo pipefail

# Usage: ./issue.sh <provider> <compatibility-dir>
#
# If the provider has versions in target.json without a verification record,
# creates a GitHub issue for each failed version.

provider="${1:?"Usage: issue.sh <provider> <compatibility-dir>"}"
dir="${2:?"Usage: issue.sh <provider> <compatibility-dir>"}"

# Find versions in target.json that have no verification JSON
missing=()
for version in $(jq -r '.versions[].softwareVersion' "$dir/target.json"); do
  if [[ ! -f "$dir/$version.json" ]]; then
    missing+=("$version")
  fi
done

if [[ ${#missing[@]} -eq 0 ]]; then
  echo "No failed versions for $provider" >&2
  exit 0
fi

image=$(jq -r '.image' "$dir/target.json")
software_source=$(jq -r '.softwareSource' "$dir/target.json")

for version in "${missing[@]}"; do
  echo "Creating issue for $provider@$version"

  gh issue create \
    --title "Compatibility failure: $provider $version" \
    --body "$(cat <<EOF
$provider $version failed compatibility testing.

- Image: \`$image:$version\`
- Release: $software_source/releases
EOF
)"
done
