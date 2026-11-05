---
'@generaltranslation/format': patch
'generaltranslation': patch
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-svelte': patch
---

Keep the ICU string parser out of the `/unstable` entries. `LocaleConfig` and `GTRuntime` now build on parser-free `LocaleConfigBase` and `GTRuntimeBase` classes (internal subpaths), which gt-i18n's `I18nConfig` uses. Legacy ICU lookups set their hash before it reaches the shared caches, so lookup keys are unchanged. There is no public API change.
