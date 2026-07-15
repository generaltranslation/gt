---
'gt-i18n': patch
---

Collapse the I18nCache constructor-time validation layer into a single helper. Observable behavior is unchanged: the same warnings are logged when a custom `runtimeUrl` is configured without GT credentials, and providing `loadDictionary` without a source `dictionary` still throws. The unreachable validation branches are removed, slightly shrinking browser bundles.
