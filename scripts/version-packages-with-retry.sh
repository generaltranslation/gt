#!/usr/bin/env bash
set -euo pipefail

max_attempts="${VERSION_PACKAGES_ATTEMPTS:-3}"
delay_seconds="${VERSION_PACKAGES_RETRY_DELAY_SECONDS:-10}"
attempt=1

while true; do
  if pnpm exec changeset version; then
    break
  else
    status=$?
  fi

  if ! git diff HEAD --quiet --exit-code; then
    echo "changeset version failed after modifying files; refusing to retry"
    exit "$status"
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    exit "$status"
  fi

  attempt=$((attempt + 1))
  echo "changeset version failed with exit code $status; retrying in ${delay_seconds}s (attempt ${attempt}/${max_attempts})"
  sleep "$delay_seconds"
done

pnpm exec oxfmt packages/*/CHANGELOG.md
