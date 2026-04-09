---
paths:
  - 'packages/core/**'
  - 'packages/i18n/**'
  - 'packages/supported-locales/**'
---

# Core Library Rules

- `generaltranslation` (packages/core) is the foundation package. Almost everything depends on it — changes here have wide blast radius.
- `gt-i18n` (packages/i18n) builds on core and provides the runtime i18n layer.
- `@generaltranslation/supported-locales` provides locale metadata.
- These packages must remain framework-agnostic — no React, Next.js, or Node.js-specific imports. Engine agnostic as well.
- Run `pnpm build` from root after making changes here to verify downstream packages still compile.
- Exports use subpath exports (e.g., `/internal`, `/types`). Internal subpaths are not public API but are used across packages.
- Be careful with breaking changes to `/internal` subpaths — other packages in the monorepo depend on them.
