---
'@generaltranslation/icu': minor
---

`validateMessageTree` and `isMessageTree` now reject four kinds of tree that passed before. Neither `templateToMessage` nor `icuToMessage` makes any of them:

- A `select`, `plural` or `selectordinal` without an `other` branch. Formatting it threw for any value that matched no branch.
- `0`, the plural count, outside a plural or selectordinal branch. It formatted as nothing, and printed as a `#` that ICU reads back as text.
- A variable name, tag name or branch key that ICU cannot write, such as an empty name or one with a space. The tree printed as an ICU string that does not parse.
- A plural offset that is not a safe integer, such as `0.5`. The parser reads only whole offsets, and formatting a bigint count with a fractional one threw.

A tree built by `templateToMessage` or read by `icuToMessage` is unaffected. A hand-written translation in one of these forms is now invalid, and the runtime renders the source message in its place.
