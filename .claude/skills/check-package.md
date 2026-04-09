---
name: check-package
description: Run full validation (build + lint + test + typecheck) on a package
user-invocable: true
allowed-tools: Bash(pnpm *), Bash(npx *)
argument-hint: '<package-name>'
---

Run full validation on a specific package in the monorepo.

## Steps

Run these checks sequentially for the specified package (`$ARGUMENTS`):

1. **Build:** `pnpm --filter $ARGUMENTS build`
2. **Type check:** Resolve the package directory from the Key Packages table in `CLAUDE.md` (the directory name often differs from the npm package name, e.g. `gt` → `packages/cli`). Then run `cd packages/<dir> && npx tsc --noEmit`.
3. **Lint:** `pnpm --filter $ARGUMENTS lint`
4. **Test:** `pnpm --filter $ARGUMENTS test`

## After running

- Report a summary: which checks passed and which failed
- For failures, diagnose the issue and suggest fixes
- If all checks pass, confirm the package is ready
