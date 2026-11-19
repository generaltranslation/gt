---
'gt-vue': patch
---

`gt-vue` imports `HTML_CONTENT_PROPS` from the `@generaltranslation/format` root, because the types-only subpaths are removed. Bundlers still tree-shake the import, and locale matching still loads lazily. Code that runs in plain Node without a bundler, such as unbundled SSR, now loads the `@generaltranslation/format` root module when it imports `gt-vue`.
