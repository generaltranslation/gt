---
'@generaltranslation/format': patch
'generaltranslation': patch
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-vue': patch
'gt-svelte': patch
---

A locale `Intl` has no data for formats in the default locale, not in the host's locale. Such a locale is a private-use code without an alias (`qaa` to `qtz`), or a standard one a runtime lacks data for, like Welsh numbers in Chrome.

Given that locale alone, `Intl` formatted in the locale of the server or of each browser, so one build showed different number and date formats to different users, and picked different plural branches for the same count. `GTIntl`, translated messages, `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>`, `<Plural>`, translated `<T>` content and `useFormatLocales()` now give `Intl` the locale, then the default locale.

- A locale `Intl` has data for formats as before: `Intl` uses the first locale of a list it has data for.
- A call that passes its own `locales` still reaches `Intl` with those alone.
- When `Intl` has no data for the default locale either, it formats in the host's locale.
