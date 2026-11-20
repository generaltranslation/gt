---
'@generaltranslation/format': minor
'generaltranslation': major
---

`GTIntl` formats in the `locale` of the call, else of the instance, else the default locale, and gives `Intl` the default locale behind it. It no longer puts `en` behind them.

- A locale `Intl` has no data for formats in the default locale, as before. When `Intl` has no data for the default locale either, it formats in the host's locale, where it used to format in `en`. A call's `locales` reach `Intl` as they are.
- A custom alias is still replaced by its code before it reaches `Intl`.

Formatting a message tree through `GTIntl` is 2.4 times faster for a catalog that is mostly plain text, and 25% faster for one where every message has structure.
