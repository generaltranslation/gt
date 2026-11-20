---
'gt': minor
'generaltranslation': minor
---

The CLI extracts tagged-template messages written with `t`, `useGT()`, and `getGT()`, imported from a GT entry such as `gt-react` or `gt-i18n`, as message trees. It supports `` t`...` `` and `` t({ context, maxChars, requiresReview })`...` ``, bare values as anonymous variables, `${{ name }}` variables, the `plural`, `ordinal`, `select`, `number`, `date`, `part`, and `derive` helpers, and `n` for the plural count. It reads `derive()` variants and whether a bare value, or a helper value passed without a name, is a plain value from TypeScript types, using the project's `typescript` package (an optional peer dependency; TypeScript 6 and earlier, or 7.1 and later, since 7.0 has no compiler API) and the nearest tsconfig that includes the file; a `derive()` argument must be typed as a string literal or a union of them. A `Date` is a plain value only as a helper's value, as in `date(due)`; a bare `Date` is skipped, since it needs `date()` to be formatted. Without `strictNullChecks`, TypeScript hides `undefined`, which `derive()` renders as no text, so the empty variant is extracted too. A branch template literal with values that is not `part`...`` skips the message, since the runtime would render the values as text. It hashes each tree with `hashSource` and uploads it as an `MESSAGE_TREE` entry in the GTJSON file. A message that cannot be analyzed statically is skipped with a warning.

`Updates`, now derived from `ContentByFormat`, and `GTJsonFormatMetadata` accept `MESSAGE_TREE` message tree entries.
