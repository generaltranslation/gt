---
'@generaltranslation/react-core': patch
---

Remove the internal `setup/cookieNames` pass-through and other internal re-exports. `@generaltranslation/react-core/pure` still exports the same names, now directly from `gt-i18n`, `generaltranslation`, and `@generaltranslation/format`. No public API change.
