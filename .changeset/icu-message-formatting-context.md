---
'@generaltranslation/icu': minor
---

Message trees convert to ICU and back without loss.

- Each `number`, `date` and `time` option is either a message option, kept in the tree (`style`, `unit`, date and time fields), or formatting context (`currency`, digits, `timeZone` and the rest). A date's or a time's named style is `style`, as for a number: `{ style: 'medium' }`, not Intl's `dateStyle` or `timeStyle`. `buildMessageTree` returns the context as `formats`, and `formatMessageTree(tree, locales, values, { formats, timeZone })` applies it.
- `icuToMessageTree(icu)` takes no options and no longer restores formats from a source, and `findConflictingFormat` is removed.
- The `MessageVariables` type is removed: `MessageTreeValues<R>` types the values of `formatMessage` and `formatMessageTree`.
