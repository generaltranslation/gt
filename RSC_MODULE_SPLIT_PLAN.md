# RSC Module Split Plan

## Current Hypothesis

Next's RSC build resolves React through the `react-server` condition. The failing
`createContext is not a function` path comes from server-selected barrels
evaluating client context/provider/hook modules at import time.

The fix should be structural: add an RSC-safe `@generaltranslation/react-core`
entry and point `gt-react/context` server exports at it, without relying on
tree-shaking.

## Files Changed

- `packages/react-core/src/rsc.ts`
- `packages/react-core/package.json`
- `packages/react-core/tsdown.config.mts`
- Pure helper splits under `packages/react-core/src/components/**`,
  `packages/react-core/src/hooks/**`, and
  `packages/react-core/src/utils/translation/**`
- `packages/react/src/context.server.ts`
- `packages/react/src/components/translation/T.tsx`
- `packages/next/src/index.server.ts`

## Completed Steps

- Created branch `e/odysseus/rsc-module-split` in worktree
  `~/Documents/dev/gt-wt/e-odysseus-rsc-module-split`.
- Installed dependencies with `pnpm install`.
- Confirmed `gt-react/context.server` imports modules that evaluate context,
  provider, and hook code.
- Added an RSC-safe `@generaltranslation/react-core/rsc` entry.
- Repointed `gt-react/context`'s react-server implementation at the RSC-safe
  entry.
- Replaced server exports of provider/client selector APIs with local throwing
  placeholders.
- Replaced `gt-next` server re-exports of `LocaleSelector` and `RegionSelector`
  from `index.client` with server-safe throwing placeholders.
- Verified generated server-selected bundles do not reference `createContext`,
  `useContext`, `useSyncExternalStore`, `GTContext`, `InternalGTProvider`,
  `gt-react/client`, or `index.client`.

## Remaining Validation

- None.

## Validation Completed

- `pnpm --filter @generaltranslation/react-core build`
- `pnpm --filter gt-react build`
- Built declaration prerequisites:
  `@generaltranslation/format`, `generaltranslation`, `gt-i18n`,
  `@generaltranslation/next-internal`, and
  `@generaltranslation/supported-locales`
- `pnpm --filter gt-next build:no-swc-plugin`
- `cd tests/apps/next/base && pnpm build`

## Follow-up Cleanup

- Consider moving more shared RSC helpers into narrower internal files if
  future APIs need to be exposed through `react-server`.
