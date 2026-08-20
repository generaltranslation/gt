#!/usr/bin/env bash
set -euo pipefail

jq '.baseBranch = "odysseus" | .changelog = "@changesets/cli/changelog"' .changeset/config.json > .changeset/config.tmp.json
mv .changeset/config.tmp.json .changeset/config.json
git update-index --assume-unchanged .changeset/config.json

pnpm run version-packages
