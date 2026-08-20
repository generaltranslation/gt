---
'@generaltranslation/react-core': patch
---

Return an empty snapshot and warn when `getTranslationsSnapshot()` cannot load translations for a locale, instead of letting the loader error propagate. Selecting a locale whose translation files do not exist yet crashed server route loaders (such as the TanStack Start root loader) with an HTTP 500 in development; content for that locale now renders untranslated.
