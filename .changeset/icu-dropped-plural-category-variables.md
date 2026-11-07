---
'@generaltranslation/icu': patch
---

`icuToMessageTree(translation, { source, locale })` takes the translation's locale. Following CLDR, a translation uses only its locale's plural categories, so it may leave out a category the locale does not have, such as `one` in Japanese, together with variables the source uses only there. Categories come from `Intl.PluralRules` (ordinal categories for `selectordinal`). A variable used anywhere else, including in an exact `=N` branch, a `select` branch, or a category the locale has, must still appear, and without `locale` every source variable is still required.
