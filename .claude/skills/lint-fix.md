---
name: lint-fix
description: Run ESLint with auto-fix on changed files
user-invocable: true
allowed-tools: Bash(npx eslint *), Bash(pnpm lint *), Bash(git *)
argument-hint: "[package-name, file path, or 'all']"
---

Run ESLint with auto-fix on the General Translation monorepo.

## Usage

- If `$ARGUMENTS` specifies a package name: `pnpm --filter <package-name> lint:fix`
- If `$ARGUMENTS` specifies a file: `npx eslint --fix <file>`
- If `$ARGUMENTS` is "all" or empty: `pnpm lint:fix`
- To lint only staged files: `npx eslint --fix $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|tsx|jsx)$')`

## After running

- Report remaining warnings/errors that couldn't be auto-fixed
- For unfixable issues, read the source and suggest manual fixes
