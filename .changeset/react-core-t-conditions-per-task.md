---
'@generaltranslation/react-core': patch
---

The `t` and `m` from `/unstable` read whether the app is client-rendered, whether i18n is enabled and the locale once per task instead of once per message. A new locale, enabled flag or config is seen by them in the next task.
