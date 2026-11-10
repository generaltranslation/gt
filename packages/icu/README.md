# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages. Formatting relies on the host's `Intl` implementation;
no locale-data polyfills are shipped.

## Entry points

- `@generaltranslation/icu`: message trees, without the parser.
  `formatMessageTree()`, `validateMessageTree()` and `isMessageTree()`.
- `@generaltranslation/icu/convert`: `icuToMessageTree()` and
  `messageTreeToIcu()` convert between ICU strings and message trees.
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
  { timeZone: 'America/New_York' }
); // '2 files from Ada'
```

The formatters take the time zone of dates and times as an argument. This
package does not read the host's time zone; its caller passes one in.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
