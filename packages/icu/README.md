# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages.

The package provides:

- Message trees: compact JSON messages that format without a parser
- ICU MessageFormat parsing with location-aware ASTs
- AST printing for stable hashing and source transforms
- String interpolation, selects, cardinal and ordinal plurals
- Number, date, time, and ICU skeleton formatting through native `Intl` APIs

It intentionally relies on the host's `Intl` implementation and does not ship
locale-data polyfills.

## Entry points

- `@generaltranslation/icu` is parser-free and works with message trees:
  `formatMessageTree(tree, locales?, variables?)`, `buildMessageTree()` for
  building canonical trees from template strings and holes, and
  `validateMessageTree()` / `isMessageTree()` for checking untrusted tree JSON.
- `@generaltranslation/icu/convert` converts between ICU strings and message
  trees: `icuToMessageTree(icu, { source? })` and `messageTreeToIcu(tree)`.
- `@generaltranslation/icu/parser` is the ICU string parser for code that
  formats ICU strings directly: `parse()`,
  `formatMessage(message, locales?, variables?)`, `printAST()`, and the
  syntax-tree types with `TYPE` and `SKELETON_TYPE`.

A message tree is an array where text is a string, `#` is `0`, and each
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
  { count: 2, name: 'Ada' }
); // '2 files from Ada'
```

Plain values (strings, numbers, bigints, booleans, Dates) format as text, as
in a template literal, with `null` and `undefined` as nothing; a date or time
node formats a Date for the locale. The result is then typed `string`. Rich
values, such as React elements or what a tag formatter returns, stay as parts;
the result is then typed `string | R | (string | R)[]`. `formatMessage` on
`/parser` formats ICU strings the same way, with the same types.

`messageTreeToIcu` prints Intl options as a standard ICU skeleton, or the named
`percent` style, that standard ICU reads as the same options and
`icuToMessageTree` reads back exactly. ICU engines still apply their own
defaults, as for any `{n, number}`: ICU4C rounds half-even where Intl rounds
half away from zero. Options with no such spelling, such as `timeZone` or
`dateStyle`, are dropped whole.
To read a translation of a printed tree, pass the tree as `source`: its formats
are restored, and the translation must use the same variables.

```ts
import {
  icuToMessageTree,
  messageTreeToIcu,
} from '@generaltranslation/icu/convert';

messageTreeToIcu([['price', 'number', { currency: 'USD', style: 'currency' }]]);
// '{price, number, ::currency/USD}'

const source = [
  'Due ',
  ['due', 'date', { dateStyle: 'medium', timeZone: 'UTC' }],
];
messageTreeToIcu(source); // 'Due {due, date}'
icuToMessageTree('Échéance {due, date}', { source });
// ['Échéance ', ['due', 'date', { dateStyle: 'medium', timeZone: 'UTC' }]]
```

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
