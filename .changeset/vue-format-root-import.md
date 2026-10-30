---
'gt-vue': patch
---

`gt-vue` imports `HTML_CONTENT_PROPS` from the `@generaltranslation/format` root and `decodeOptions` from the `gt-i18n` root, because the types-only subpaths are removed. Bundlers still tree-shake both imports, and locale matching still loads lazily. Code that runs in plain Node without a bundler, such as unbundled SSR, now loads the `@generaltranslation/format` and `gt-i18n` root modules when it imports `gt-vue`.
