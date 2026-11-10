---
'@generaltranslation/icu': patch
'@generaltranslation/format': patch
---

`@generaltranslation/icu` and `@generaltranslation/format` share one cache of Intl formatters.

- `formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Messages that format a number, a plural or a date render about 20 times faster.
- A date formatted without a `timeZone` follows the host's time zone when it changes, in `formatDateTime` and the other date functions too. It was kept in the zone of its first use.
- The cache holds at most 256 instances of each constructor. It had no limit.
