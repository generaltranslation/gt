# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages. Formatting relies on the host's `Intl` implementation;
no locale-data polyfills are shipped.

## Entry points

- `@generaltranslation/icu`: message trees, without the parser.
  `formatMessageTree()`, `validateMessageTree()` and `isMessageTree()`.
- `@generaltranslation/icu/convert`: `icuToMessageTree()` and
  `messageTreeToIcu()` convert between ICU strings and message trees without
  loss, and `checkTranslation()` checks a translation against its source.
- `@generaltranslation/icu/parser`: the ICU string parser. `parse()`,
  `formatMessage()`, `printAST()` and the syntax-tree types.
- `@generaltranslation/icu/internal`: shared by General Translation packages;
  not a public API, and it may change in any release.

A message tree is compact JSON. A message without placeholders is one string
(`'Save'`, or `''` when empty); any other is an array where text is a string,
`#` is `0`, and each placeholder is a tuple that starts with its variable name.
The same rule holds for each plural or select branch and a tag's children:

```ts
import { formatMessageTree } from '@generaltranslation/icu';

// '{count, plural, one {# file} other {# files}} from {name}'
formatMessageTree(
  [
    ['count', 'plural', { one: [0, ' file'], other: [0, ' files'] }],
    ' from ',
    ['name'],
  ],
  'en',
  { count: 2, name: 'Ada' }
); // '2 files from Ada'
```

A tree holds only what ICU spells: named styles such as
`['total', 'number', 'currency']` or `['due', 'date', 'medium']` (Intl's
`dateStyle`), a unit, and date and time fields. Other Intl options, like the
currency or a time zone, are formatting context, passed by variable name:

```ts
formatMessageTree(
  ['Total: ', ['total', 'number', 'currency']],
  'en',
  { total: 5 },
  { formats: { total: { currency: 'EUR' } }, timeZone: 'UTC' }
); // 'Total: €5.00'
```

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
