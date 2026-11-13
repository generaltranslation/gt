---
'gt-i18n': minor
'@generaltranslation/react-core': minor
---

Rename the `message` field of translation lookups to `content`, to match `GLOSSARY.md`: it holds content in any data format, JSX and message trees included, not only string messages. No behavior changes.

- `gt-i18n/internal`: `TranslateListenerLookup` is `{ locale, content, options }`, and the entries passed to a lookup's `prefetchEntries` are `{ content, options }`.
- `@generaltranslation/react-core`: `TranslateLookup` is `{ locale, content, options }`.

`RegisteredMessage.message` is unchanged: it is a string message.
