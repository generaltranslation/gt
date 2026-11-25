---
'gt-i18n': patch
---

A malformed ICU translation falls back to its source, formatted in the source locale, instead of being shown raw. When the source cannot be formatted either, such as when a variable is missing from the call, the translation is still shown raw.
