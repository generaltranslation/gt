---
'gt-i18n': patch
---

`t` returns a message or translation without placeholders as it is, without calling the formatter, once formatting has accepted the locale. A translated tree from the catalog is validated the first time it renders instead of on every render.
