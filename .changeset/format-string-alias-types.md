---
'@generaltranslation/format': minor
'generaltranslation': minor
---

Remove the `IcuMessage`, `I18nextMessage` and `StringMessage` types from `@generaltranslation/format`, `@generaltranslation/format/types` and `generaltranslation/types`. Each was an alias of `string` and checked nothing; use `string`. `ContentByFormat`, `ContentFor`, `StringContent` and `Content` are unchanged.
