---
paths:
  - 'packages/cli/**'
  - 'packages/gtx-cli/**'
---

# CLI Package Rules

- The `gt` CLI (`packages/cli`) is the primary command-line tool. `gtx-cli` is a thin wrapper.
- CLI entry point is `src/main.ts`. Library entry point is `src/index.ts`.
- Uses `commander` for argument parsing and `chalk` for terminal output.
- The CLI has a pre-commit hook that generates `src/generated/version.ts` — never edit this file manually.
- Test with `pnpm --filter gt test`. Type-check with `pnpm --filter gt typecheck`.
- When adding new CLI commands, follow the existing pattern in `src/cli/`.
