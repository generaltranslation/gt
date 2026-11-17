---
paths:
  - 'packages/react/**'
  - 'packages/react-core/**'
  - 'packages/react-native/**'
  - 'packages/next/**'
  - 'packages/tanstack-start/**'
---

# React Package Rules

- These packages provide i18n components and hooks for React-based frameworks.
- `react-core` is the foundation. `react` and `react-native` extend it. `next` and `tanstack-start` extend `react`.
- Exports are split by entry point and export condition (e.g., gt-next's `/server`, `/link`, `/compat`, and its `react-server`/`browser` conditions). Check `package.json` `exports` field before adding new public API.
- Compatibility APIs (the dictionary API) go under `/compat`, following "Compatibility APIs" in `AGENTS.md`. Keep `gt-react/compat` and `gt-react-native/compat` at parity like the main entries.
- Never import from framework-specific packages (like `next`) in `react-core` or `react` — they must stay framework-agnostic.
- Use React Server Components patterns in `gt-next`: separate `index.client.ts`, `index.server.ts` and `index.rsc.ts` entry points.
- Run tests with `pnpm --filter <package-name> test`.

## `t()` is client-rendered (SPA) only

`t()` works only in client-rendered (SPA) apps, the ones set up with gt-react's `initializeGTSPA()`. This covers the root `t` from `gt-react`, and `t` and `m` from `/unstable`. A server-rendered app (gt-next, gt-tanstack-start, gt-react with `initializeGT()`) does not support `t()` anywhere: module level, server rendering, and its client-side code (components after hydration, effects, event handlers) alike. Server-rendered code uses `useGT()` in components, `getGT()` in loaders and server functions, or `msg()` with `m()` from `useMessages()` or `getMessages()`.

- Exports: only gt-react's browser entry (`index.client.ts`) exports `t`. Its server and `react-server` entries, gt-tanstack-start, gt-next and gt-react-native do not, and no package sets a global `t`.
- Runtime: `reportServerRenderedUse()` in `packages/react-core/src/unstable/spaOnly.ts` reports every call of all three. Outside an SPA it throws in development and logs in production, where `t()` renders the source.

## Feature Parity: gt-react ↔ gt-react-native

`gt-react` and `gt-react-native` are fixed-version siblings (see `.changeset/config.json`). Both re-export most of their API from `@generaltranslation/react-core`, with platform-specific wrappers (e.g., GTProvider, locale detection, storage). Names that `gt-i18n` or `generaltranslation` own are re-exported straight from that owner, because `react-core` does not re-export them. Plumbing that only sibling packages use (render pipeline, React i18n cache, format-locale helpers) is not re-exported; siblings import it from `@generaltranslation/react-core/pure`.

These re-exports follow "Imports and re-exports" in `AGENTS.md`; `pnpm check:reexports` checks which files re-export and which packages they re-export from.

**When reviewing or implementing changes:**

- If a new component, hook, or function is added to `gt-react`, check whether an equivalent should be added to `gt-react-native` (and vice versa). Most exports from `react-core` should be re-exported from both packages.
- Platform-specific features (e.g., `LocaleSelector`/`RegionSelector` are DOM-only) are exempt from parity.
- Compare `packages/react/src/index.*.ts` and `packages/react-native/src/index.tsx` exports to spot gaps.
- If a change intentionally breaks parity, the PR description should explain why.
