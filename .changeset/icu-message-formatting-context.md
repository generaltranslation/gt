---
'@generaltranslation/icu': minor
---

Message trees convert to ICU and back without loss.

- Each `number`, `date` and `time` option is either a message option, kept in the tree (`style`, `unit`, `dateStyle`, `timeStyle`, date and time fields), or formatting context (`currency`, digits, `timeZone` and the rest). `buildMessageTree` returns the context as `formats`, and `formatMessageTree(tree, locales, values, { formats, timeZone })` applies it.
- `icuToMessageTree(icu)` takes no options and no longer restores formats from a source, and `findConflictingFormat` is removed.
