---
'gt-next': patch
'@generaltranslation/react-core': patch
---

`gt-next` and `@generaltranslation/react-core` use `RegisteredMessage` from `gt-i18n` instead of declaring their own copies. The copy in `gt-next` had fallen behind, so the messages passed to its `useGT()` and `useMessages()` now also accept `$format`, `$locale` and `$requiresReview`.
