#!/usr/bin/env bash
set -euo pipefail

config_file='.changeset/config.json'
config_backup=$(mktemp)
config_updated=$(mktemp)
cp "$config_file" "$config_backup"

restore_config() {
  cp "$config_backup" "$config_file"
  rm -f "$config_backup" "$config_updated"
}
trap restore_config EXIT

# The Iris release branch needs its own comparison base, while the committed
# Changesets configuration must continue to target main.
jq '.baseBranch = "iris" | .changelog = "@changesets/cli/changelog"' "$config_file" > "$config_updated"
mv "$config_updated" "$config_file"

pnpm run version-packages
