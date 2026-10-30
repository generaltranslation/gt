---
'generaltranslation': minor
'@generaltranslation/compiler': minor
'gt': minor
---

feat: add the experimental `experimental.splitting` option and the locale twins build contract

- `gt.config.json` accepts a top-level `experimental.splitting: 'locale' | 'locale-twins'` (default `'locale'`). Locale twins are experimental. The option is typed in `generaltranslation/types` (`GTExperimentalConfig`; any string is accepted, so spreading an imported `gt.config.json` into `initializeGT`/`initializeGTSPA` typechecks; the experimental compiler plugin rejects unknown values at build time, and runtimes treat them as `'locale'`) and validated by the config schema.
- The new `generaltranslation/internal/experimental` subpath exports the shared locale twins contract: `resolveTranslationSplitting()` and the splitting helpers, placeholder encoding, decoding and search, filled table serialization and parsing (a table lists its source-text fallbacks in `s`), and the versioned twin manifest type with a validating parser. The regular `generaltranslation/internal` and `generaltranslation/types` entry points carry none of it.
- `@generaltranslation/compiler/experimental` accepts `splitting` (overrides `experimental.splitting`) and `localeTwins: { missingTranslations, spaBootstrap, vendorChunk, localeCookieName, enableI18nCookieName }` options and resolves them when the plugin is created. The regular `@generaltranslation/compiler` ignores them.
