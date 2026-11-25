---
'@generaltranslation/compiler': patch
---

The compiler now reads `_tagIds` given as a top-level option, as it reads `defaultLocale`, `locales`, `projectId`, `_versionId` and `files`. Before, it dropped `_tagIds`, so a build given `_tagIds: true` and `experimentalSplitTranslations.minifyHashes: true` as options was not rejected. The options type now lists only these `gt.config.json` keys, the ones the compiler reads from its options; it ignored the others.
