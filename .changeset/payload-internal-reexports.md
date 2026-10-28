---
'gt-payload': patch
---

Import format types and `ApiError` from `@generaltranslation/format` and `@generaltranslation/api` instead of through `generaltranslation`. `GTIntl` still comes from `generaltranslation`, which fills in its defaults. gt-payload now depends directly on `@generaltranslation/format` and `@generaltranslation/api`. No public API change.
