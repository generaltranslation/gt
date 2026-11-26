---
'@generaltranslation/format': patch
'generaltranslation': patch
---

`GTIntl.formatMessageTree()` returns a `string` when every value is plain: a string, number, bigint, boolean, `Date`, `null` or `undefined`. It returned `unknown`, and still does for rich values and tag formatters. `formatMessageTree()` in `generaltranslation/internal` does the same.
