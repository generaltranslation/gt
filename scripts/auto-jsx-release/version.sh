#!/usr/bin/env bash
set -euo pipefail

test "$(jq -r '.mode' .changeset/pre.json)" = pre
test "$(jq -r '.tag' .changeset/pre.json)" = auto-jsx

# Follow the Iris wrapper: keep main's committed Changesets configuration intact.
config_file='.changeset/config.json'
config_backup=$(mktemp)
config_updated=$(mktemp)
cp "$config_file" "$config_backup"
trap 'cp "$config_backup" "$config_file"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
jq '.baseBranch = "e/release/auto-jsx-experimental" | .changelog = "@changesets/cli/changelog"' "$config_file" > "$config_updated"
cp "$config_updated" "$config_file"
pnpm run version-packages
