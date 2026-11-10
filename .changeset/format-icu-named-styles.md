---
'@generaltranslation/icu': minor
'@generaltranslation/format': minor
'generaltranslation': patch
---

ICU dates and times format as ICU does. The named styles, as in `{d, date, medium}` and `{t, time, short}`, use Intl's `dateStyle` and `timeStyle`, and a date or time without a style is the medium style: `{d, date}` is `May 6, 2020` in `en-US`, not `5/6/2020`. Skeletons read `S` as fractional seconds, `B` as the day period and `O` or `v` as the time zone name, and `::unit/` keeps a compound unit such as `kilometer-per-hour`.
