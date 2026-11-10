---
'@generaltranslation/icu': minor
---

Message trees convert to ICU and back without loss.

- Each `number`, `date` and `time` option is either a message option, kept in the tree (`style`, `unit`, date and time fields), or formatting context (`currency`, digits, `timeZone` and the rest). A date's or a time's named style is `style`, as for a number: `{ style: 'medium' }`, not Intl's `dateStyle` or `timeStyle`. `templateToMessage` returns the context as `formats`, and `formatMessageTree(tree, locales, values, { formats, timeZone })` applies it. `formats` is required, `{}` when a message has none; `formatMessage`, for an ICU string, takes no `formats`.
- `icuToMessageTree(icu)` is now `icuToMessage(icu)` and returns a `Message`, `{ tree, formats }`. Any ICU string the parser reads converts: the formatting context it spells, like `::currency/EUR .00`, an hour cycle or `scale/100`, goes to `formats` by variable, so the same sentence in two currencies is one tree. `styles` passes the app's own style names, in the shape of react-intl's `formats` prop. It takes no source, and `findConflictingFormat` is removed.
- The new `checkTranslation(source, translation, { locale })` compares a translation's variables and styles with its source. The translation is the `Message` that `icuToMessage` reads, and formatting context it sets, like a currency or an hour cycle, is reported: a translation cannot set any.
- The `MessageVariables` type is removed: `MessageValues<R>` types the values of `formatMessage` and `formatMessageTree`.
