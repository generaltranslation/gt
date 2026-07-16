---
'gt': minor
---

Add `gt migrate`: converts a next-intl Next.js App Router project to gt-next. Dictionary-compat by default — imports, provider, routing config, and middleware are rewritten while existing per-locale catalogs keep working through a generated `loadDictionary.ts`, so no re-translation is needed. `--inline` additionally converts pure-static `t('key')` calls in JSX-child position to inline `<T>` content. Files using APIs with no gt-next equivalent are skipped whole and next-intl keeps rendering them (nested inside `GTProvider`) until they're migrated by hand; every skip and TODO is listed in a generated `gt-migrate-report.md`. Installs `gt-next` with the project's package manager when missing, supports `--dry-run`, refuses to run on a dirty git tree, and buffers all writes until every transform succeeds.
