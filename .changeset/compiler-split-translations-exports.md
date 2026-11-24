---
'@generaltranslation/compiler': minor
---

Export `findJsxHashes`, which lists the hashes of the `<T>` call sites in code a bundler wrote, `findHashTokens`, which lists every token in code shaped like a hash whatever surrounds it, and `isSplitTranslationsEnabled`, which resolves `experimentalSplitTranslations.enabled` against the `GT_SPLIT_TRANSLATIONS` environment variable. gt-next's `experimentalSplitTranslations` uses them.
