---
'gt-i18n': minor
'@generaltranslation/react-core': minor
'gt-next': minor
---

Add an optional inline translations callback to `gt()`, `msg()`, and `<T>` (`inline`). The callback returns the translation for a locale, or `undefined` to fall back to loaded translations. It is designed to be injected at build time so embedded translations are tree-shaken with unused call sites. `I18nCache` accepts an experimental `inlinedLocales` option: those locales never load or expire translations, and `msg()` stores its embedded translations in their caches under the message hash, so `m()` resolves them with a normal lookup and the server's translations snapshot sends them to the client.
