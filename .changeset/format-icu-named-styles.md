---
'@generaltranslation/format': minor
'generaltranslation': patch
---

ICU messages formatted with `formatMessage` (and `_formatMessageICU`) follow ICU for dates and times: the named styles `{d, date, short|medium|long|full}` and `{t, time, short|medium|long|full}` format as Intl's `dateStyle` and `timeStyle` instead of field approximations, so `{d, date, short}` is `5/6/20` in `en-US` and `06.05.20` in `de-DE`. A date or time without a style is the medium style, so `{d, date}` is `May 6, 2020` in `en-US` instead of `5/6/2020`, and `{t, time}` is Intl's medium time. Skeletons read `S`, `SS` and `SSS` as fractional seconds (longer runs show three digits), `B`, `BBBB` and `BBBBB` as the day period, and `O`, `OOOO`, `v` and `vvvv` as time zone names, where `S` was ignored and the others threw. A `::unit/` skeleton keeps its whole unit, as in `::unit/kilometer-per-hour`; `::measure-unit/` still drops its category.
