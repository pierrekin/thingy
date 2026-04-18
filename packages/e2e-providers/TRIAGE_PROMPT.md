# Compatibility Failure Triage

You are triaging compatibility test failures for the Mantle provider system.

## Setup

List open issues with both `compatibility-failure` and `claude-triage` labels:

```
gh issue list --label "compatibility-failure" --label "claude-triage" --state open
```

If there are no matching issues, stop.

## For each issue

The issue title follows the format: `Compatibility failure: <provider> <version>`

The issue body contains the Docker image and the upstream release URL.

### Step 1: Reproduce the failure

Run the test for the specific provider and version:

```
bun run packages/e2e-providers/validate.ts <provider>@<version>
```

Read the test output to understand what failed.

### Step 2: Understand the upstream change

Check the upstream project's release notes and changelog for the failing version. The release URL is in the issue body. Compare the API surface of the failing version against the last known-good version in `target.json`. Focus on:

- API endpoint changes (renamed, removed, restructured)
- Response schema changes (fields renamed, removed, type changes)
- Authentication changes
- Configuration changes that affect how the provider connects

### Step 3: Triage

Classify the failure into one of two categories:

**Category 1: Fixable without design decisions.** The upstream change is mechanical — an endpoint moved, a field was renamed, a response wrapper changed — but the conceptual model of what the provider checks is still valid. The same checks still make sense, they just need to read from a different place.

**Category 2: Requires design decisions.** The upstream change fundamentally alters what the provider monitors. Examples: a feature was removed entirely, the data model changed in a way that makes existing checks meaningless, or the provider would need new check types to remain useful.

### Step 4: Act

**If Category 1:**
1. Fix the provider code to work with the new version, in a new branch called `claude/provider/{provider}/{version}`.
2. Run `bun run check` from the `mantle/` directory to verify no type errors or lint failures were introduced
3. Run the test again to verify the fix: `bun run packages/e2e-providers/validate.ts <provider>@<version>`
4. Create a PR with the fix, the updated target.json, and the verification record, use a single line commit and reuse this as the PR title "feat(provider): add compatibility for {provider} {version}". Set the PR body as per your findings.
5. Remove the `claude-triage` label from the issue
6. Comment on the issue linking the PR

**If Category 2:**
1. Comment on the issue with your findings:
   - What changed upstream
   - Why the current provider logic is incompatible
   - What design decisions are needed
2. Remove the `claude-triage` label from the issue (to avoid re-triaging on the next run)
