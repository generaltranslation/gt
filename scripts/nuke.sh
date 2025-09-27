#!/bin/bash

# Define the directories to delete
TARGET_DIRS=("node_modules" ".next" "dist" ".turbo" "package-lock.json" ".jest_coverage" ".jest-cache")

# Get the current working directory (monorepo root)
MONOREPO_ROOT=$(pwd)

echo "🧹 Starting cleanup in: $MONOREPO_ROOT"

# Find and delete the target directories
for dir in "${TARGET_DIRS[@]}"; do
  echo "Searching for '$dir' directories..."
  find "$MONOREPO_ROOT" -type d -name "$dir" -prune -exec rm -rf {} + -print
done

echo "🥳 Cleanup complete."