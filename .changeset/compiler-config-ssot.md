---
'@generaltranslation/compiler': patch
---

The `enableAutoJsxInjection`, `autoderive` and `devHotReload` plugin options take their types from `generaltranslation`'s `GTParsingFlags`, and the compiler uses `resolveAutoderive()` from `generaltranslation/config-schema`. No behavior changes.
