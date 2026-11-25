---
'gt-i18n': patch
'gt-node': patch
---

`setI18nCache()` and `getI18nCache()` from `gt-i18n/internal` take and return an `I18nCache<Content>`, without a type parameter, since one cache holds content of every data format. gt-node's `initializeGT()` registers an `I18nCache<Content>` instead of an `I18nCache<string>`.
