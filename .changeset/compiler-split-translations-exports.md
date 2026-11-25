---
'@generaltranslation/compiler': minor
---

Add the `@generaltranslation/compiler/internal` entry for gt-next's `experimentalSplitTranslations`, which loads without Babel. It exports `findJsxHashes`, which lists the hashes of the `<T>` call sites in code a bundler wrote, `findHashTokens`, which lists every token in code shaped like a hash whatever surrounds it, and `trackReplacements` and `moveSourceMapFile`, which keep a source map file accurate after its code is rewritten. The package now declares an `exports` map with its main entry and `./internal`, so files under `dist/` can no longer be imported by path.
