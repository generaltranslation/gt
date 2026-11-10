---
'@generaltranslation/icu': minor
---

Message trees convert to ICU and back without loss.

- Each `number`, `date` and `time` option is either a message option, kept in the tree (`style`, `unit`, `dateStyle`, `timeStyle`, date and time fields), or formatting context (`currency`, digits, `timeZone` and the rest). `buildMessageTree` returns the context as `formats`, and `formatMessageTree(tree, locales, values, { formats, timeZone })` applies it.
- A message, branch or tag without placeholders is one string: `MessageTree` is `string | MessageNode[]`.
- `icuToMessageTree(icu)` takes no options. The new `checkTranslation(source, translation, { locale })` compares a translation's variables and styles with its source, and `findConflictingFormat` is removed.
- The formatter caches the locale it resolves for a locale string, and returns plain text as is.
