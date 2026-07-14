---
'gt-i18n': patch
---

Flatten the internal i18n cache structure: the locale-cache layer is inlined into `I18nCache`, the in-flight promise dedupe shared by the caches is extracted into one helper, and the dev-only prefetch machinery is statically gated behind `process.env.NODE_ENV !== 'production'` so production bundles drop it. No public API changes; `gt-i18n/internal` and `gt-i18n/internal/types` exports are unchanged.
