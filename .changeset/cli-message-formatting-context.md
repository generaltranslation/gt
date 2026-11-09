---
'gt': minor
---

Tagged-template extraction reads `number()`, `date()` and the new `time()` options by the `@generaltranslation/icu` classification. Message options (`style`, `unit`, `dateStyle`, `timeStyle` and date or time fields) must still be literals; formatting context such as `currency` or `timeZone` may be any expression, is not evaluated, and does not change the extracted tree or its hash. A variable given two different literal formatting contexts in one message is skipped with the builder's error. The skip for a variable with two formats ICU spells alike is removed, since trees now keep every format. A message without placeholders, including `msg('Save')`, is extracted as one string tree with the shared builder, so its hash changes once.
