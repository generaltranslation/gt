---
'@generaltranslation/icu': minor
'@generaltranslation/format': patch
---

Rename `formatMessage` in `@generaltranslation/icu/parser` to `formatIcu`, and its options type `FormatMessageOptions` to `FormatIcuOptions`. It formats an ICU string, and the name now says so, like `icuToMessage` and `messageToIcu`. `@generaltranslation/icu/convert` no longer exports the `IcuMessage` type: `messageToIcu` returns `{ icu, formats }` as before. Nothing else changes: `formatMessage` in `@generaltranslation/format` and `generaltranslation` keeps its name and behavior.
