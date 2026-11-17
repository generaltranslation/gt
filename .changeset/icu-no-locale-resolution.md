---
'@generaltranslation/icu': minor
---

`formatMessageTree` and `formatIcu` give their locales to `Intl` as they are, and no longer resolve them first.

- A locale that is not a language tag throws `Intl`'s `RangeError` when the message formats a number, a date or a plural with it. A message of text, variables and selects alone no longer throws for one.
- An empty list formats in the host's locale, as it does for `Intl`, instead of throwing.
- In `formatIcu`, the hour of a `::j` skeleton is the hour of the first locale given, not of the first one `Intl` supports.

Formatting a catalog that is mostly plain text is about 30% faster, and `formatMessageTree` bundles 150 bytes smaller after gzip.
