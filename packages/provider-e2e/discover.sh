#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./discover.sh <dir> [--limit N]        — list last N correlated versions
#   ./discover.sh <dir> diff [--limit N]   — list last N not already in target
#   ./discover.sh <dir> write [--limit N]  — add new versions to target.json
#
# Expects <dir>/target.json and <dir>/discover.json.

dir="${1:?"Usage: discover.sh <dir> [diff|write] [--limit N]"}"
shift

mode="list"
limit=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) limit="$2"; shift 2 ;;
    diff|write) mode="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

target="$dir/target.json"
discover="$dir/discover.json"

if [[ ! -f "$target" ]]; then
  echo "File not found: $target" >&2
  exit 1
fi
if [[ ! -f "$discover" ]]; then
  echo "File not found: $discover" >&2
  exit 1
fi

# Read image and repo from target.json, filters from discover.json
docker_image=$(jq -r '.image' "$target")
release_repo=$(jq -r '.softwareSource' "$target" | sed -E 's|https://github.com/||')

docker_filter=$(jq -r '.docker.filter' "$discover")
docker_normalize=$(jq -r '.docker.normalize' "$discover" | sed 's/\$\([0-9]\)/\\\1/g')

release_filter=$(jq -r '.releases.filter' "$discover")
release_normalize=$(jq -r '.releases.normalize' "$discover" | sed 's/\$\([0-9]\)/\\\1/g')

# Phase 1: List raw candidates from both sources
docker_tags=$(crane ls "$docker_image" 2>/dev/null)
release_tags=$(gh api "repos/$release_repo/releases" --paginate --jq '.[] | select(.prerelease == false) | .tag_name' 2>/dev/null)

# Phase 1.5 + 2: Filter and build "normalized\toriginal" pairs
docker_pairs=$(echo "$docker_tags" \
  | tr -d '\r' \
  | grep -E "$docker_filter" \
  | while read -r tag; do
      norm=$(echo "$tag" | sed -E "s/$docker_filter/$docker_normalize/")
      printf '%s\t%s\n' "$norm" "$tag"
    done \
  | sort -t$'\t' -k1,1V -u)

release_pairs=$(echo "$release_tags" \
  | tr -d '\r' \
  | grep -E "$release_filter" \
  | while read -r tag; do
      norm=$(echo "$tag" | sed -E "s/$release_filter/$release_normalize/")
      printf '%s\t%s\n' "$norm" "$tag"
    done \
  | sort -t$'\t' -k1,1V -u)

# Phase 3: Correlate on normalized version, carry original tags through
# Extract normalized versions from each side, intersect, then join back
docker_norms=$(echo "$docker_pairs" | cut -f1)
release_norms=$(echo "$release_pairs" | cut -f1)
correlated_norms=$(grep -Fxf <(echo "$docker_norms") <(echo "$release_norms") | sort -uV || true)

if [[ -z "$correlated_norms" ]]; then
  echo "No correlated versions found." >&2
  exit 0
fi

# Apply limit: take the last N correlated versions
latest_norms=$(echo "$correlated_norms" | tail -n "$limit")

# Phase 4: Subtract existing versions if diff or write mode
if [[ "$mode" == "diff" || "$mode" == "write" ]]; then
  existing=$(jq -r '.versions[].softwareVersion' "$target")
  if [[ -n "$existing" ]]; then
    result_norms=$(grep -Fxvf <(echo "$existing") <(echo "$latest_norms") | sort -V || true)
  else
    result_norms="$latest_norms"
  fi
  if [[ -z "$result_norms" ]]; then
    echo "No new versions found." >&2
    exit 0
  fi
else
  result_norms="$latest_norms"
fi

# Build output: look up original docker tag and release tag for each normalized version
new_entries=$(echo "$result_norms" | while read -r norm; do
  dtag=$(echo "$docker_pairs" | awk -F'\t' -v n="$norm" '$1 == n { print $2; exit }')
  rtag=$(echo "$release_pairs" | awk -F'\t' -v n="$norm" '$1 == n { print $2; exit }')
  printf '%s\n' "{\"tag\":\"$dtag\",\"softwareVersion\":\"$norm\",\"releaseTag\":\"$rtag\"}"
done | jq -s .)

if [[ "$mode" == "write" ]]; then
  # Write only tag + softwareVersion to target.json
  target_entries=$(echo "$new_entries" | jq '[.[] | {tag, softwareVersion}]')
  jq --argjson new "$target_entries" '.versions += $new' "$target" > "$target.tmp" \
    && mv "$target.tmp" "$target"
  echo "Wrote $(echo "$target_entries" | jq length) version(s) to $target" >&2
fi

echo "$new_entries"
