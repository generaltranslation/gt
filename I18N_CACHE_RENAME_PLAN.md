# I18nManager to I18nCache Rename Plan

Base branch: `e/codex/i18n-store-initializer`

Goal: rename the cache-oriented `I18nManager` APIs to `I18nCache` with a stacked PR sequence that keeps downstream packages compiling until each package is migrated.

## Stack

1. `e/i18n-cache-file-rename`
   - Rename files and directories only.
   - Examples: `i18n-manager` -> `i18n-cache`, `I18nManager.ts` -> `I18nCache.ts`, `ReactI18nManager.ts` -> `ReactI18nCache.ts`, `BrowserI18nManager.ts` -> `BrowserI18nCache.ts`, `async-i18n-manager` -> `async-i18n-cache`.
   - Update import paths so behavior and symbols remain unchanged.
   - Do not rename classes, functions, variables, types, comments, test descriptions, or strings except where a path or filename must change.

2. `e/i18n-cache-i18n-symbols`
   - Scope: `packages/i18n`.
   - Rename internal programming symbols from `I18nManager`/`i18nManager` to `I18nCache`/`i18nCache`.
   - Rename package-local types such as `I18nManagerConfig`, `I18nManagerConstructorParams`, and lifecycle callback names.
   - Export the new names and preserve old names as deprecated aliases, for example:
     - `export { I18nCache, I18nCache as I18nManager }`
     - `export { getI18nCache, getI18nCache as getI18nManager }`
     - `export { setI18nCache, setI18nCache as setI18nManager }`
     - Equivalent type aliases with `@deprecated` JSDoc comments.
   - Update `packages/i18n` tests.

3. `e/i18n-cache-react-core`
   - Scope: `packages/react-core`.
   - Consume `gt-i18n` new exports (`I18nCache`, `getI18nCache`, `setI18nCache`, renamed types).
   - Rename `ReactI18nManager` symbols to `ReactI18nCache` and update package-local call sites/tests.
   - Keep external exports compatible where needed with deprecated aliases.

4. `e/i18n-cache-react`
   - Scope: `packages/react`.
   - Rename current and deprecated React browser manager/cache symbols to cache names.
   - Update imports from `@generaltranslation/react-core/context` and `gt-i18n/internal` to consume cache names where available.
   - Keep compatibility aliases for exported React APIs during the stack.

5. `e/i18n-cache-tanstack-start`
   - Scope: `packages/tanstack-start`.
   - Consume `I18nCache` and React cache exports.
   - Rename local variables and user-facing internal code references.

6. `e/i18n-cache-node`
   - Scope: `packages/node`.
   - Rename `async-i18n-cache` symbols and any imports/exports using manager names.
   - Update package tests.

7. `e/i18n-cache-next`
   - Scope: `packages/next`.
   - Consume `I18nCache` from `gt-i18n/internal`.
   - Rename package-local config fields, mocks, and tests that refer to `I18nManager`.

8. `e/i18n-cache-remove-deprecated-aliases`
   - Remove all temporary deprecated `I18nManager` compatibility aliases introduced by this stack.
   - Remove this plan file.
   - Run broad validation.

## Parallelization Notes

- PR 1 must be first because all later branches depend on renamed paths.
- PR 2 must precede all downstream package symbol migrations because it introduces the new `gt-i18n` exports.
- After PR 2, `react-core`, `tanstack-start`, `node`, and `next` can mostly be prepared independently, but `react` should follow `react-core` because it consumes `@generaltranslation/react-core/context`.
- The final cleanup PR must be last so aliases remain available while package-by-package PRs are reviewed.

## Validation

- For PR 1: `pnpm --filter gt-i18n build`, `pnpm --filter @generaltranslation/react-core build`, `pnpm --filter gt-react build`, `pnpm --filter gt-tanstack-start build`, `pnpm --filter gt-node build`.
- `pnpm --filter gt-i18n test` currently has pre-existing failures in `t.test.ts` and `locale-defaults.test.ts` because they import `setConditionStore` from the i18n singleton module, which does not export it on the base branch.
- For package symbol PRs: run each changed package's tests and package build if tests do not cover export/type surfaces.
- For final cleanup: run `pnpm build` and `pnpm test` from the repo root if practical.
