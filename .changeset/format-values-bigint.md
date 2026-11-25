---
'@generaltranslation/format': patch
'generaltranslation': patch
---

`FormatValues` accepts a `bigint`, as `@generaltranslation/icu` formats one: with `formatIcu` from `generaltranslation`, `formatIcu('{n}', { values: { n: 12n } })` now type-checks. It is derived from icu's `MessagePlainValue`.
