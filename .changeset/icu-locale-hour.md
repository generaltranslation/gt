---
'@generaltranslation/icu': major
---

The hour of a `::j` skeleton is `Intl`'s to pick when a message is formatted, the same way for an ICU string and for a message tree. Nothing reads a locale when a message is parsed.

- **`parse()` no longer takes a `locale` option.** It rewrote `j` to the locale's hour symbol; `j` now stays in the skeleton. Remove the option.
- **Where `j` meets another hour symbol in a skeleton, the last one decides the clock,** as in ICU: `::hj` is the locale's hour and `::jh` a 12-hour one. `formatIcu` let `j` win and `formatMessageTree` the other symbol.
- **`formatIcu` no longer reads a region override,** like `en-u-rg-gbzzzz`, for `::j`: `Intl` does not read it, and `formatMessageTree` never did. Name the hour cycle with `-u-hc-`, as in `en-u-hc-h23`, which `Intl` reads.
- **`::jjjjj` throws in every locale.** `formatIcu` formatted it where the locale has a 24-hour clock.
