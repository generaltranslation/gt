---
'@generaltranslation/icu': minor
'@generaltranslation/format': patch
---

Rename `formatMessage` in `@generaltranslation/icu/parser` to `formatIcu`, and its options type `FormatMessageOptions` to `FormatIcuOptions`. It formats an ICU string, and everywhere else in the package a message is a tree and its `formats`, so the name now says what it takes, like `icuToMessage` and `messageToIcu`. Nothing else changes: `formatMessage` in `@generaltranslation/format` and `generaltranslation` keeps its name and behavior.
