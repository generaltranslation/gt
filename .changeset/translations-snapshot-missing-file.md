---
'@generaltranslation/react-core': patch
---

Return a snapshot with no entry for the locale, and warn, when `getTranslationsSnapshot()` cannot load translations for that locale, instead of letting the loader error propagate. Selecting a locale whose translation files do not exist yet crashed server route loaders (such as the TanStack Start root loader) with an HTTP 500 in development; content for that locale now renders untranslated. Because the failed locale is omitted rather than hydrated as an empty cache entry, a later lookup retries the loader once translations exist.
