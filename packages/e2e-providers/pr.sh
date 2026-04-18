#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pr.sh <provider> <compatibility-dir>
#
# If the provider has uncommitted changes, creates a branch off main with
# just those changes and opens a PR.

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
title="feat(provider): add compatibility for $provider $latest_version"
body="$(cat <<EOF
Add compatibility verification for $provider:
$(echo "$new_versions" | sed 's/^/- /')
EOF
)"

if [[ -n "${DRY_RUN:-}" ]]; then
  echo "[dry-run] Would create PR for $provider:"
  echo "  branch: $branch_name"
  echo "  title: $title"
  echo "  body:"
  echo "$body" | sed 's/^/    /'
  echo "  files:"
  echo "$changed" | sed 's/^/    /'
  exit 0
fi

echo "Creating PR for $provider: $latest_version"

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
main_sha=$(gh api "/repos/$repo/git/refs/heads/main" --jq .object.sha)

gh api -X POST "/repos/$repo/git/refs" \
  -f "ref=refs/heads/$branch_name" \
  -f "sha=$main_sha" >/dev/null

additions="[]"
deletions="[]"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if [[ -f "$path" ]]; then
    contents=$(base64 < "$path" | tr -d '\n')
    additions=$(jq --arg p "$path" --arg c "$contents" \
      '. + [{path: $p, contents: $c}]' <<<"$additions")
  else
    deletions=$(jq --arg p "$path" '. + [{path: $p}]' <<<"$deletions")
  fi
done <<<"$changed"

payload=$(jq -n \
  --arg repo "$repo" \
  --arg branch "$branch_name" \
  --arg headline "$title" \
  --arg oid "$main_sha" \
  --argjson additions "$additions" \
  --argjson deletions "$deletions" \
  '{
    query: "mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid url } } }",
    variables: {
      input: {
        branch: {repositoryNameWithOwner: $repo, branchName: $branch},
        message: {headline: $headline},
        fileChanges: {additions: $additions, deletions: $deletions},
        expectedHeadOid: $oid
      }
    }
  }')

echo "$payload" | gh api graphql --input - >/dev/null

gh pr create --title "$title" --body "$body" --head "$branch_name" --base main
