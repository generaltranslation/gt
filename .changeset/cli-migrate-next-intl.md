---
'gt': minor
'@generaltranslation/migrate': minor
---

Add `gt migrate`: converts a next-intl Next.js App Router project to gt-next. Dictionary-compat by default — imports, provider, routing config, navigation wrappers, and middleware are rewritten while existing per-locale catalogs keep working through a generated `loadDictionary.ts`, so no re-translation is needed; transforms that would embed source text (`t.rich` → `<T>`, static `t('key')` inlining) are out of scope and skip with a report entry pointing at manual conversion. Files using APIs with no gt-next equivalent are skipped whole and next-intl keeps rendering them in the page's locale (request config rewired through gt-next's `getLocale()`, provider nested inside `GTProvider`) until they're migrated by hand; every skip and TODO is listed in a generated `gt-migrate-report.md`. Teardown is scope-safe: any file outside the scan that still imports next-intl blocks the removal of next-intl and its config files. Installs `gt-next` with the project's package manager when missing, supports `--dry-run`, refuses to run on a dirty git tree, and buffers all writes until every transform succeeds.

The migration engine ships as a separate, optional package (`@generaltranslation/migrate`) rather than inside the gt CLI, so the CLI stays small for the majority of users who never migrate. The `gt migrate` command is a thin shell that loads the engine on demand: the first `gt migrate` run fetches it (or uses it directly when it is already a workspace or project dependency), then keeps it cached.
