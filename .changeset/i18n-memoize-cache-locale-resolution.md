---
'gt-i18n': patch
---

perf(i18n): `I18nCache` resolves each lookup locale once per config instead of on every lookup, keeping the existing alias, dialect-fallback and invalid-locale behavior
