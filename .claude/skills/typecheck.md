---
name: typecheck
description: Run TypeScript type checking across the monorepo
user-invocable: true
allowed-tools: Bash(npx tsc *), Bash(pnpm *)
argument-hint: "[package-name or 'all']"
---

Run TypeScript type checking for the General Translation monorepo.

## Usage

- If `$ARGUMENTS` specifies a package name: `cd packages/<package-dir> && npx tsc --noEmit`
- If `$ARGUMENTS` is "all" or empty: `pnpm typecheck` or run `npx tsc --noEmit` in each package

## After running

- Report errors concisely, grouped by file
- For each error, suggest the fix if straightforward
- Common issues: missing types, incorrect imports from internal subpaths, generic type mismatches
