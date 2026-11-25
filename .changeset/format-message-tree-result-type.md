---
'@generaltranslation/icu': minor
'@generaltranslation/format': patch
'generaltranslation': patch
---

`GTIntl.formatMessageTree()` types its result by its values, as `formatMessageTree` in `@generaltranslation/icu` does: a `string` from plain values, and `FormattedMessage<R>` from rich values or tag formatters. It returned `unknown` for both. `formatMessageTree()` in `generaltranslation/internal` does the same. `@generaltranslation/icu` exports the `OnePartValues` type that these signatures use.
