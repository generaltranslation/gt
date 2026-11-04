---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-next': minor
---

Add an optional inline translations callback to `gt()`, `msg()`, and `<T>` (`_translations`). The callback returns the translation for a locale, or `undefined` to fall back to loaded translations. It is designed to be injected at build time so embedded translations are tree-shaken with unused call sites. `msg()` registers its callback in a module-level registry keyed by message hash, so `m()` resolves it without an extra parameter.
