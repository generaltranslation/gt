# I18nCache Rename PR Plan

Base branch: `e/codex/i18n-store-initializer`

Working stack prefix: `e/codex/i18n-cache-*`

## Constraints

- Do not touch anything under `/deprecated` directories.
- Keep old package entrypoints out of scope unless they are required for the requested internal/context entrypoints.
- In `packages/i18n`, only expose the transition through `/internal` and `/internal/types`.
- In `packages/react-core`, only concern public consumers through the `context` entrypoint.
- In `packages/react`, only concern public consumers through the `context` entrypoints.
- Do not include `packages/next` in this stack.
- Prefer small, reviewable PRs. Correctness is more important than parallelizing work.

## PR 1: File And Directory Renames

Branch: `e/codex/i18n-cache-file-renames`

- Rename non-deprecated files and directories that are named for `I18nManager` to the equivalent `I18nCache` form.
- Update import/export module specifiers only as needed to follow the renamed files.
- Avoid renaming program symbols in this PR except where a filename import path requires it.
- Expected paths:
  - `packages/i18n/src/i18n-manager` -> `packages/i18n/src/i18n-cache`
  - `packages/i18n/src/i18n-cache/I18nManager.ts` -> `I18nCache.ts`
  - `packages/react-core/src/i18n-manager` -> `packages/react-core/src/i18n-cache`
  - `packages/react-core/src/i18n-cache/ReactI18nManager.ts` -> `ReactI18nCache.ts`
  - `packages/react/src/i18n-manager` -> `packages/react/src/i18n-cache`
  - `packages/react/src/i18n-cache/BrowserI18nManager.ts` -> `BrowserI18nCache.ts`
  - `packages/node/src/async-i18n-manager` -> `packages/node/src/async-i18n-cache`

## PR 2: `packages/i18n` Internal Symbols

Branch: `e/codex/i18n-cache-i18n-symbols`, stacked on PR 1.

- Rename internal `I18nManager` programming symbols to `I18nCache`.
- Rename singleton helpers and local variables to `getI18nCache`, `setI18nCache`, and `i18nCache`.
- Keep deprecated aliases in `packages/i18n/src/internal.ts` and `packages/i18n/src/internal-types.ts`:
  - Export new `I18nCache` names.
  - Export old `I18nManager` names as deprecated aliases.
- Update `packages/i18n` tests.

## PR 3: `packages/react-core` Context Symbols

Branch: `e/codex/i18n-cache-react-core`, stacked on PR 2.

- Update the React Core context-facing cache symbols:
  - `ReactI18nManager` -> `ReactI18nCache`
  - `ReactI18nManagerParams` -> `ReactI18nCacheParams`
  - `getReactI18nManager` -> `getReactI18nCache`
  - `setReactI18nManager` -> `setReactI18nCache`
- Keep deprecated aliases on the `context` entrypoint.
- Update imports and tests outside `/deprecated` only as required by the renamed context helpers.

## PR 4: `packages/react` Context Symbols

Branch: `e/codex/i18n-cache-react`, stacked on PR 3.

- Update the React context entrypoints and browser cache implementation:
  - `BrowserI18nManager` -> `BrowserI18nCache`
  - `BrowserI18nManagerParams` -> `BrowserI18nCacheParams`
- Consume the new React Core context names.
- Keep deprecated aliases on React `context` entrypoints where those names are exported.
- Update tests outside `/deprecated`.

## PR 5: `packages/tanstack-start`

Branch: `e/codex/i18n-cache-tanstack-start`, stacked on PR 4.

- Consume `I18nCache` and React Core cache helpers from the updated internal/context entrypoints.
- Rename local variables away from `i18nManager`.
- Update tests if affected.

## PR 6: `packages/node`

Branch: `e/codex/i18n-cache-node`, stacked on PR 5.

- Consume `I18nCache`, `getI18nCache`, and `setI18nCache`.
- Rename `async-i18n-manager` internal references to `async-i18n-cache`.
- Rename local variables away from `i18nManager`.
- Update tests outside `/deprecated`.

## PR 7: Cleanup Deprecated Aliases

Branch: `e/codex/i18n-cache-remove-deprecated-aliases`, stacked on PR 6.

- Remove deprecated `I18nManager` compatibility aliases introduced by the stack.
- Remove this plan file.
- Run focused package tests and a final build check if feasible.

## Parallelization Notes

- PR 1 must land first because later branches depend on file paths.
- After PR 2, React Core, React, TanStack Start, and Node can be audited independently in separate worktrees if needed, but stacked PRs still need a deterministic order.
- Because React depends on React Core context exports, do React Core before React.
- TanStack Start and Node are mostly independent after PR 2/PR 3 and can be implemented in parallel if review timing matters.
