---
'gt-sanity': patch
---

Import `GTIntl`, `LocaleConfig`, format types, and API types from `@generaltranslation/format` and `@generaltranslation/api` instead of through `generaltranslation`, and re-export the document internationalization plugin directly from `@sanity/document-internationalization`. gt-sanity now depends directly on `@generaltranslation/format` and `@generaltranslation/api`. No public API change.
