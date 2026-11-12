# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages. Formatting relies on the host's `Intl` implementation;
no locale-data polyfills are shipped.

## Entry points

- `@generaltranslation/icu`: message trees, without the parser.
  `formatMessageTree()`, `validateMessageTree()` and `isMessageTree()`.
- `@generaltranslation/icu/convert`: `icuToMessage()` reads an ICU string as
  a message, and `messageTreeToIcu()` prints a message tree as an ICU string.
- `@generaltranslation/icu/parser`: the ICU string parser. `parse()`,
  `formatMessage()`, `printAST()` and the syntax-tree types.
- `@generaltranslation/icu/internal`: shared by General Translation packages;
  not a public API, and it may change in any release.

A message tree is compact JSON where text is a string, `#` is `0`, and each
placeholder is a tuple that starts with its variable name:

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
  { count: 2, name: 'Ada' },
  { formats: {}, timeZone: 'America/New_York' }
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

A message is a tree and its `formats` together, and that pair holds everything
an ICU string can say. `icuToMessage()` reads any ICU string as one: what
changes the sentence stays in the tree, and the rest goes to `formats`:

```ts
import { icuToMessage } from '@generaltranslation/icu/convert';

icuToMessage('Total: {total, number, ::currency/EUR .00}');
// {
//   tree: ['Total: ', ['total', 'number', 'currency']],
//   formats: {
//     total: { currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 2 },
//   },
// }
```

The same sentence in another currency is the same tree, so it is translated
once. `formats` is by variable, so a string that gives one variable two
formatting contexts is rejected. Pass an app's own style names in `styles`, in
the shape react-intl takes as its `formats` prop.

The formatters take every argument: the locales, the values, and the time
zone of dates and times. This package applies no defaults to them and does
not read the host's time zone; its caller passes them in.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
