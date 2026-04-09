---
name: test
description: Run tests for specific packages or the entire monorepo
user-invocable: true
allowed-tools: Bash(pnpm *), Bash(npx vitest *)
argument-hint: "[package-name or 'all']"
---

Run tests for the General Translation monorepo.

## Usage

- If `$ARGUMENTS` specifies a package name, run: `pnpm --filter <package-name> test`
- If `$ARGUMENTS` is "all" or empty, run: `pnpm test`
- If `$ARGUMENTS` specifies a file path, run: `npx vitest run <path>`

## After running

- Report the results concisely: how many tests passed/failed
- If tests fail, read the failing test files and the source they test to diagnose the issue
- Suggest fixes if the failures are straightforward
