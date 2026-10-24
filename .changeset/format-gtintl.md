---
'@generaltranslation/format': major
---

The `LocaleConfig` class is now `GTIntl`, and `LocaleConfig` is the plain-data type it takes (`{ defaultLocale?, locales?, customMapping? }`). `GTIntl` also takes an optional target `locale`, the default for every call:

- `new LocaleConfig({ defaultLocale, locales, customMapping })` → `new GTIntl({ defaultLocale, locales, customMapping }, { locale })`; `LocaleConfigConstructorParams` → `LocaleConfig`.
- Formatters drop the positional target locale: `config.formatNum(n, 'es', options)` → `intl.formatNum(n, { ...options, locale: 'es' })`, and likewise for `formatCurrency`, `formatDateTime`, `formatList`, `formatListToParts`, `formatRelativeTime`, `formatRelativeTimeFromDate`, `formatMessage`, and `formatCutoff`.
- `config.requiresTranslation(target, source, approved)` → `intl.requiresTranslation({ locale: target, sourceLocale: source, approvedLocales: approved })`; without a locale it checks the instance `locale`, then `defaultLocale`. Omitted `locales` still mean no restriction, but `locales: []` now approves no locale.
- `config.determineLocale(candidates, approved)` → `intl.determineLocale(candidates, { approvedLocales: approved })`.
- `getLocaleName`, `getLocaleProperties`, `getLocaleEmoji`, and `getLocaleDirection` take an optional locale (default: the target locale) and `{ locale }`; names are in the target locale, which is `defaultLocale` without an instance or per-call locale.
- New: `intl.getRegionProperties(region, { locale })` names the region in the target locale and reads names and emojis from the `regionCode` entries of `customMapping`.
- `GTIntl` copies and freezes its configuration: `locales` and `customMapping` are readonly, and later changes to the objects you passed have no effect. `LocaleConfig.locales` accepts a readonly array.
