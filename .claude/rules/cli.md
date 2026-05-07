---
paths:
  - 'packages/cli/**'
  - 'packages/gtx-cli/**'
---

# CLI Package Rules

- The `gt` CLI (`packages/cli`) is the primary command-line tool. `gtx-cli` is a thin wrapper.
- CLI entry point is `src/main.ts`. Library entry point is `src/index.ts`.
- Uses `commander` for argument parsing and `chalk` for terminal output.
- `src/generated/version.ts` is ignored and generated from `package.json` by `node scripts/generate-version.js` — never edit or track it manually.
- Test with `pnpm --filter gt test`. Type-check with `pnpm --filter gt typecheck`.
- When adding new CLI commands, follow the existing pattern in `src/cli/`.
