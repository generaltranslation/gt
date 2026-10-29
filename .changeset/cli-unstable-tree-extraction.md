---
'gt': minor
'generaltranslation': minor
'@generaltranslation/format': minor
---

The CLI extracts tagged-template messages written with the unstable API (`t`, `useGT()`, and `getGT()` imported from an `/unstable` entry such as `gt-react/unstable` or `gt-i18n/unstable`) as ICU syntax trees. It supports `` t`...` `` and `` t({ context, maxChars, requiresReview })`...` ``, bare values as anonymous variables, `${{ name }}` variables, the `plural`, `selectordinal`, `select`, `number`, `date`, `part`, and `derive` helpers, and `n` for the plural count. It reads `derive()` variants and whether a bare value, or a helper value passed without a name, is a plain value from TypeScript types, using the project's `typescript` package (an optional peer dependency; TypeScript 6 and earlier, or 7.1 and later, since 7.0 has no compiler API) and the nearest tsconfig that includes the file; a `derive()` argument must be typed as a string literal or a union of them. A branch template literal with values that is not `part`...`` skips the message, since the runtime would render the values as text. It hashes each tree with `hashMessageTree` and uploads it as an `ICU_TREE` entry in the GTJSON file. A message that cannot be analyzed statically is skipped with a warning. Imports from the unstable entries no longer reach the legacy string and JSX extractors.

`DataFormat` adds `'ICU_TREE'` for ICU syntax tree content. `Updates` and `GTJsonFormatMetadata` accept it. Runtime translation options keep rejecting it.
