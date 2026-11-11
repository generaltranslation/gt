---
'@generaltranslation/icu': minor
'@generaltranslation/format': minor
'generaltranslation': patch
'gt-i18n': patch
---

`@generaltranslation/icu` and `@generaltranslation/format` share one cache of Intl formatters, and take what they format with as arguments.

- `formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Messages that format a number, a plural or a date render about 20 times faster.
- `@generaltranslation/icu` and `@generaltranslation/format` apply no defaults to their own parameters and read neither the host's time zone nor the clock. The `locales`, a message's `variables`, the `timeZone` of dates and times, and the `baseDate` of `formatRelativeTimeFromDate` are required, as are `LocaleConfig`'s `defaultLocale`, `locales` and `timeZone`.
- `generaltranslation` is the only package that resolves what a caller leaves out: its formatting functions and `LocaleConfig` keep their optional arguments, and it reads the host's time zone, once for the process. gt-i18n formats through it and no longer fills in a default itself.
- The cache holds at most 256 instances of each constructor. It had no limit.
