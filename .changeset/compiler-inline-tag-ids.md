---
'@generaltranslation/compiler': major
---

The compiler reads `_tagIds` given as a top-level option, as it reads `defaultLocale`, `locales`, `projectId`, `_versionId` and `files`. It dropped `_tagIds`, so a build given `_tagIds: true` and `experimentalSplitTranslations.minifyHashes: true` as options was not rejected.

**Breaking:** the options type lists only those six `gt.config.json` keys, the ones the compiler reads from its options. It accepted every key and ignored the rest, so `vite({ defaultLocale: 'en', timeZone: 'UTC' })` type-checked and the `timeZone` did nothing. Pass a whole config under `gtConfig`:

```diff
- vite({ defaultLocale: 'en', timeZone: 'UTC' })
+ vite({ gtConfig: { defaultLocale: 'en', timeZone: 'UTC' } })
```
