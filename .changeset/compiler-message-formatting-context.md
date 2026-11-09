---
'@generaltranslation/compiler': minor
---

Compile-time `$_hash` injection supports `time()` and injects a hash when a `number()`, `date()` or `time()` formatting-context option, such as `currency` or `timeZone`, is an expression. Message options (`style`, `unit`, `dateStyle`, `timeStyle` and date or time fields) must still be literals. The injected hash of a message without placeholders changes once, since its tree is one string.
