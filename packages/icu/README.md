# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages.

The package provides:

- ICU MessageFormat parsing with location-aware ASTs
- Parser-free formatting and building of ICU syntax trees
- AST printing for stable hashing and source transforms
- String interpolation, selects, cardinal and ordinal plurals
- Number, date, time, and ICU skeleton formatting through native `Intl` APIs

It intentionally relies on the host's `Intl` implementation and does not ship
locale-data polyfills.

## Entry points

- `@generaltranslation/icu` is parser-free: syntax-tree types, `TYPE` and
  `SKELETON_TYPE`, `formatAst(ast, locales?, variables?)`, `buildMessageTree()`
  for building canonical trees from template strings and holes, and
  `validateMessageTree()` /
  `isMessageTree()` for checking untrusted tree JSON.
- `@generaltranslation/icu/parser` parses ICU strings: `parse()`,
  `formatMessage(message, locales?, variables?)`, and `printAST()`.

```ts
import { formatAst } from '@generaltranslation/icu';
import { parse } from '@generaltranslation/icu/parser';

formatAst(parse('Hello {name}'), 'en', { name: 'Ada' }); // 'Hello Ada'
```

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
