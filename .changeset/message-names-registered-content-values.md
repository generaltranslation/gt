---
'gt-i18n': minor
'@generaltranslation/format': minor
'generaltranslation': minor
'@generaltranslation/react-core': patch
'gt-next': patch
'gt-tanstack-start': patch
---

Rename three names to match `GLOSSARY.md`. No behavior changes.

- The `Message` type in `gt-i18n/types`, a string message with its metadata as passed to `getGT()` and `useGT()`, is now `RegisteredMessage`, exported from `gt-i18n`. `Message` is left to mean a message tree and its formats.
- `hashMessage` in `gt-i18n/internal` is now `hashContent`: it hashes content in any data format, JSX included.
- `LocaleConfig.formatMessageTree()` takes the data for its variables as `values`, not `variables`, as `formatMessageTree` does everywhere else. This also applies to `LocaleConfig` in `generaltranslation` and `I18nConfig` in `gt-i18n`.
