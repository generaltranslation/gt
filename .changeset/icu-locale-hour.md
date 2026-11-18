---
'@generaltranslation/icu': minor
---

The hour a locale prefers is read when a message is formatted, the same way for an ICU string and for a message tree, and as ICU reads it:

- A region override, like `en-u-rg-gbzzzz`, sets the hour cycle of a `::j` skeleton, of a named time style and of a bare date. `formatMessageTree` did not read it, and neither path did for a named style: `{t, time, short}` in `en-u-rg-gbzzzz` is `19:03`, not `7:03 PM`.
- Where `j` meets another hour symbol in a skeleton, the last one decides the clock: `::hj` is the locale's hour and `::jh` a 12-hour one. `formatIcu` let `j` win and `formatMessageTree` the other symbol.
- `formatIcu` parses without a locale, so `::jjjjj` throws in every locale: it used to format where the locale has a 24-hour clock.
