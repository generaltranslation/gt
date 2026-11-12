---
'@generaltranslation/format': major
---

The `LocaleConfig` class is now `GTIntl`, and `LocaleConfig` is the plain-data type of its settings (`{ defaultLocale?, locales?, customMapping?, timeZone? }`). `GTIntl` also takes an optional target `locale`, the default for every call. Like the rest of this package, `GTIntl` here takes its settings as given: `defaultLocale` and `timeZone` are required (type `ResolvedLocaleConfig`). `GTIntl` from `generaltranslation` fills them in:

- `new LocaleConfig({ defaultLocale, locales, customMapping })` → `new GTIntl({ defaultLocale, locales, customMapping }, { locale })`; `LocaleConfigConstructorParams` → `LocaleConfig`.
- Formatters drop the positional target locale: `config.formatNum(n, 'es', options)` → `intl.formatNum(n, { ...options, locale: 'es' })`, and likewise for `formatCurrency`, `formatDateTime`, `formatList`, `formatListToParts`, `formatRelativeTime`, `formatRelativeTimeFromDate`, `formatMessage`, and `formatCutoff`.
- `config.requiresTranslation(target, source)` → `intl.requiresTranslation({ locale: target, sourceLocale: source })`; without a locale it checks the instance `locale`, then `defaultLocale`. It checks against the configured `locales`: omitted `locales` still mean no restriction, but `locales: []` now approves no locale. For another approved list, construct a `GTIntl` with `locales: approved`.
- `config.determineLocale(candidates, approved)` → `new GTIntl({ locales: approved, customMapping }).determineLocale(candidates)`; `intl.determineLocale(candidates)` matches against the configured `locales`.
- `getLocaleName`, `getLocaleProperties`, `getLocaleEmoji`, and `getLocaleDirection` take an optional locale (default: the target locale) and `{ locale }`; names are in the target locale, which is `defaultLocale` without an instance or per-call locale.
- New: `intl.getRegionProperties(region, { locale })` names the region in the target locale and reads names and emojis from the `regionCode` entries of `customMapping`.
- `GTIntl` copies and freezes its configuration: `locales` and `customMapping` are readonly, and later changes to the objects you passed have no effect. `LocaleConfig.locales` accepts a readonly array.
