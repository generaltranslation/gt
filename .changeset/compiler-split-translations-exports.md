---
'@generaltranslation/compiler': minor
---

Export `findJsxHashes`, which lists the hashes of the `<T>` call sites in code a bundler wrote, and `findHashTokens`, which lists every token in code shaped like a hash whatever surrounds it. gt-next's `experimentalSplitTranslations` uses them.
