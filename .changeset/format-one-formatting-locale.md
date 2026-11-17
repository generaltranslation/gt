---
'@generaltranslation/format': minor
'generaltranslation': major
---

`GTIntl` formats in one locale: the `locale` of the call, else of the instance, else the default locale. It no longer puts the default locale and `en` behind it as fallbacks.

- A locale `Intl` has no data for formats in the host's locale, as `Intl` does on its own, where it used to format in the default locale. To keep that fallback, pass the list: `intl.formatNum(value, { locales: [locale, defaultLocale] })`. A call's `locales` reach `Intl` as they are.
- A custom alias is still replaced by its code before it reaches `Intl`.

Formatting a message tree through `GTIntl` is 2.4 times faster for a catalog that is mostly plain text, and 25% faster for one where every message has structure.
