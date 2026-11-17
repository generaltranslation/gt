---
'gt-i18n': patch
---

Translations embedded at a call site (`inline`) match the render locale to a configured locale once, and again when the locale or the config changes, instead of on every call. That match cost more than rendering the message, so `t` and `<T>` with embedded translations were slower than with loaded ones.
