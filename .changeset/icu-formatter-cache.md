---
'@generaltranslation/icu': minor
'@generaltranslation/format': minor
'generaltranslation': patch
'gt-i18n': patch
---

`@generaltranslation/icu` and `@generaltranslation/format` share one cache of Intl formatters, and take the time zone as an argument.

- `formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Messages that format a number, a plural or a date render about 20 times faster.
- The time zone of dates and times is required in `@generaltranslation/icu` (`formatMessage`, `formatMessageTree`) and `@generaltranslation/format` (`formatDateTime`, `formatMessage`, `LocaleConfig`). Neither package reads the host's time zone.
- `generaltranslation` is where the host's time zone is read, once for the process. Its `formatDateTime`, `formatMessage` and `LocaleConfig` take an optional `timeZone` that defaults to it.
- The cache holds at most 256 instances of each constructor. It had no limit.
