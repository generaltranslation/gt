---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-next': minor
---

Add an optional inline translations callback to `gt()`, `t()`, and `<T>` (the `inline` prop). The callback returns the translation for a locale, or `undefined` to fall back to loaded translations. It is designed to be injected at build time so embedded translations are tree-shaken with unused call sites.
