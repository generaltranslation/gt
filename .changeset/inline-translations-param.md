---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-next': minor
---

Add an inline translations callback to `<T>` (the `inline` prop) and to the experimental `gt` and `t` from `/unstable` (the `$_inline` option). The callback returns the translation for a locale, or `undefined` to fall back to loaded translations. It is designed to be injected at build time so embedded translations are tree-shaken with unused call sites. The stable `gt()` and `t()` are unchanged.
