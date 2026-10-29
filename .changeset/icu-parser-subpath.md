---
'@generaltranslation/icu': minor
'generaltranslation': patch
'@generaltranslation/format': patch
'gt': patch
'@generaltranslation/react-core-linter': patch
---

Move the ICU string parser to `@generaltranslation/icu/parser`. The root entry no longer exports `parse`, `formatMessage`, or `printAST`; import them from `@generaltranslation/icu/parser` instead. The root entry now ships without the parser and adds `formatAst` for formatting syntax trees, `buildMessageTree` for building canonical trees from template parts (template text is always literal, including `#`; a `pound` hole is the plural count), and `validateMessageTree` and `isMessageTree` for checking untrusted syntax trees against the `MessageTree` type.
