---
'gt-i18n': patch
---

perf(i18n): `I18nCache` uses the locale it is given as the translation and dictionary cache key, without negotiating, validating or aliasing it on every lookup. Pass the configured locale string. A canonical spelling of an aliased locale (for example `en-GB` when `en-gb` is configured), an unconfigured dialect (`fr-FR` when only `fr` is configured) and an invalid locale are no longer mapped to a configured locale or reported as errors; they read as cache misses and fall back to source content. Request locale detection (`Accept-Language`, cookies, browser preferences) is unchanged.
