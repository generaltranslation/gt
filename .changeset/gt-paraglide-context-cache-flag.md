---
'gt': minor
---

Add `files.json.parsingFlags.enableParaglideContextCache` to `gt.config.json`. With `includeSourceCodeContext`, it has `@generaltranslation/paraglide-js` keep what it found of each source file in `gt-lock.json`, so that the next run, e.g. in CI, analyzes again only the files that changed. It is off by default.
