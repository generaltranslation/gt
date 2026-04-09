---
name: build
description: Build packages in the monorepo
user-invocable: true
allowed-tools: Bash(pnpm *), Bash(turbo *)
argument-hint: "[package-name or 'all']"
---

Build packages in the General Translation monorepo.

## Usage

- If `$ARGUMENTS` specifies a package name, run: `pnpm --filter <package-name> build`
- If `$ARGUMENTS` is "all" or empty, run: `pnpm build`
- For a clean build: `pnpm build:clean`

## After running

- Report the results concisely
- If the build fails, read the error output carefully and diagnose the issue
- TypeScript errors are the most common build failures — check the relevant source files
- Remember that `build` tasks depend on `^build` (dependencies build first), so a failure may be in an upstream package
