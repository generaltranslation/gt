---
'generaltranslation': minor
'@generaltranslation/compiler': minor
'gt': minor
---

feat: add the `files.gt.splitting` option and the locale twins build contract

- `gt.config.json` accepts `files.gt.splitting: 'locale' | 'locale-twins'` (default `'locale'`). It is typed in `generaltranslation/types`, validated by the config schema, and passed through by the CLI. Setting it has no effect yet.
- `generaltranslation/internal` exports the shared locale twins contract: placeholder encoding, decoding and search, filled table serialization and parsing, and the versioned twin manifest type with a validating parser.
- `@generaltranslation/compiler` accepts `splitting` (overrides `files.gt.splitting`) and `localeTwins: { missingTranslations, spaBootstrap, vendorChunk }` options and resolves them when the plugin is created.
