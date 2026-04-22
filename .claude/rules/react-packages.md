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
- `react-core` is the foundation. `react` and `react-native` extends it. `next` and `tanstack-start` extend `react`.
- Exports are split by entry point (e.g., `/client`, `/server`, `/internal`). Check `package.json` `exports` field before adding new public API.
- `packages/react/src/i18n-context/` has restricted imports: only `gt-i18n/types`, `gt-i18n/internal`, or `gt-i18n/internal/types`. This is enforced by ESLint. This is an alternative approach to i18n react that does NOT use react context.
- Never import from framework-specific packages (like `next`) in `react-core` or `react` — they must stay framework-agnostic.
- Use React Server Components patterns in `gt-next`: separate `index.server.ts` and `index.client.ts` entry points.
- Run tests with `pnpm --filter <package-name> test`.

## Feature Parity: gt-react ↔ gt-react-native

`gt-react` and `gt-react-native` are fixed-version siblings (see `.changeset/config.json`). Both re-export most of their API from `@generaltranslation/react-core`, with platform-specific wrappers (e.g., GTProvider, locale detection, storage).

**When reviewing or implementing changes:**

- If a new component, hook, or function is added to `gt-react`, check whether an equivalent should be added to `gt-react-native` (and vice versa). Most exports from `react-core` should be re-exported from both packages.
- Platform-specific features (e.g., `LocaleSelector`/`RegionSelector` are DOM-only) are exempt from parity.
- Compare `packages/react/src/index.ts` and `packages/react-native/src/index.tsx` exports to spot gaps.
- If a change intentionally breaks parity, the PR description should explain why.
