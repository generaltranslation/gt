---
'gt-i18n': minor
---

Split `gt-i18n/unstable` helper options into message options and formatting context, and add `time()`.

- `number()`, `date()` and the new `time()` type their options from the `@generaltranslation/icu` lists. Message options (`style` and `unit`; `dateStyle`, `timeStyle` or date and time fields) are part of the message, so each must be one literal; a union or `string` is a type error that names the option. Formatting context, such as `currency`, `maximumFractionDigits` or `timeZone`, may be any value and is not part of the tree or its hash.
- `date()` has no `timeStyle`; `time()` takes `timeStyle` or time fields only; a style cannot be combined with fields; `style: 'currency'` needs a `currency`, `style: 'unit'` needs a literal `unit`, and `unit` needs `style: 'unit'`.
- Rendering passes each placeholder's formatting context to both the source and the translation, so a translation holds only the message: `` gt`Total: ${number({ price }, { style: 'currency', currency })}` `` has the tree `["Total: ", ["price", "number", "currency"]]` for any currency. `tx` still sends only the tree, its hash and `gt()` options.
- A `Msg` keeps the formatting context in `formats`, absent when there is none, and `m()` rejects one that holds anything but formatting-context options.
- `I18nConfig` takes an optional `timeZone` (an IANA name, validated at startup, read with `getTimeZone()`), the time zone of dates and times whose call site sets none; without it the host's time zone applies.
- A message without placeholders is one string tree, as `` gt`Save` `` or `` msg({ context })`Save` `` builds it, so its catalog key changes once; `Msg.tree` may be a string. A translation without placeholders is a string too, and an empty one renders as empty text instead of falling back to the source.
