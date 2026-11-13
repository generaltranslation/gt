# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages. Formatting relies on the host's `Intl` implementation;
no locale-data polyfills are shipped.

## Entry points

- `@generaltranslation/icu`: message trees, without the parser.
  `formatMessageTree()`, `validateMessageTree()` and `isMessageTree()`.
- `@generaltranslation/icu/convert`: `icuToMessage()` reads an ICU string as
  a message, `messageToIcu()` prints a message as an ICU string,
  `messageTreeToIcu()` prints its tree alone, and `checkTranslation()` and
  `checkIcuTranslation()` check a translation against its source.
- `@generaltranslation/icu/parser`: the ICU string parser. `parse()`,
  `formatIcu()`, `printAST()` and the syntax-tree types.
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

`messageToIcu()` goes the other way. It writes the formatting context a
skeleton can spell into the string, and returns the rest, which ICU has no
syntax for:

```ts
import { messageToIcu } from '@generaltranslation/icu/convert';

messageToIcu({
  tree: [['due', 'time', { hour: 'numeric', minute: '2-digit' }]],
  formats: { due: { hourCycle: 'h23', timeZone: 'Asia/Tokyo' } },
});
// { icu: '{due, time, ::Hmm}', formats: { due: { timeZone: 'Asia/Tokyo' } } }
```

`icuToMessage()` reads that string back as the same tree, and its `formats`
with the returned ones are the message's. `messageTreeToIcu()` prints the tree
alone, which is what a translator sees: `{due, time, ::jmm}`.

`checkTranslation()` checks a translation against its source: the same
variables, the same styles, the source's exact `=N` branches and select keys,
and no formatting context of its own. Given the translation's locale, it also
checks that each plural has a branch for every category the locale has, since
a value with no branch for its category falls back to `other` and reads wrong:

```ts
import {
  checkTranslation,
  icuToMessage,
} from '@generaltranslation/icu/convert';

const source = icuToMessage('{n, plural, one {# file} other {# files}}').tree;
checkTranslation(
  source,
  icuToMessage('{n, plural, one {# файл} other {# файлов}}'),
  { locale: 'ru' }
);
// 'The translation does not match its source: "n" is missing the plural
//  branches few, many, which ru needs.'
```

It returns `undefined` when the translation matches. A category the locale
does not have, like `one` in Japanese, may be left out or kept; a branch that
is no category at all, like `lots`, is a problem.

Word order is the translation's, so a variable may repeat, and may move into
every branch of a select or plural or out of them. A reader who sees a
variable in the source must still see it: moved into one branch only, it is
lost for every other reader, and ICU formats that without complaint. A
variable inside a tag stays inside that tag:

```ts
const items = icuToMessage(
  '{n, plural, one {# item} other {# items}} for {g, select, male {him} other {them}}'
).tree;
checkTranslation(
  items,
  icuToMessage(
    '{g, select, male {{n, plural, one {# Artikel} other {# Artikel}} für ihn} other {für sie}}'
  ),
  { locale: 'de' }
);
// 'The translation does not match its source: "n" is not shown when g is
//  other, as it is in the source.'
```

Use `checkTranslation()` for a message tree, and `checkIcuTranslation()` for
ICU strings from any library, such as FormatJS or ICU4J. It applies the same
rules to what the parser reads, including what a tree cannot hold: a date
pattern like `{d, date, MM/dd/yyyy}` is the translator's to localize, so the
translation may use any pattern in its place. A source that is not valid ICU
throws; for a translation that is not, it returns the parser's message:

```ts
import { checkIcuTranslation } from '@generaltranslation/icu/convert';

checkIcuTranslation(
  '{g, select, male {He} other {They}}',
  '{g, select, masculino {Él} other {Elle}}',
  { locale: 'es' }
);
// 'The translation does not match its source: "g" is missing the select
//  branch male; "g" has the select branch masculino, which the source does
//  not.'
```

The formatters take every argument: the locales, the values, and the time
zone of dates and times. This package applies no defaults to them and does
not read the host's time zone; its caller passes them in.

## ICU compatibility

A message means what it means in ICU, and `Intl` formats it. Where the two
disagree:

1. **ICU decides what a message says**: its syntax, types, styles and
   skeletons.
2. **`Intl` does the formatting.** This package ships no locale data. What a
   message leaves unsaid is `Intl`'s default: `{n, number, integer}` rounds
   2.5 to `3`, where ICU rounds it to `2`.
3. **What `Intl` can't do throws.** `{n, number, ::permille}` throws a
   `RangeError` that names `permille`, rather than printing something else.
4. **Values aren't converted.** A number, plural or selectordinal takes a
   number, a bigint or a numeric string; a date or time takes a Date or a
   number; a select takes a string. Anything else throws a `TypeError`.

Where this package differs from ICU on purpose:

| Message                                                                                         | ICU       | Here                                          |
| ----------------------------------------------------------------------------------------------- | --------- | --------------------------------------------- |
| `{d, date, yyyy-MM-dd}`, `choice`, `{n, NUMBER}`, a branch key written twice, a value not given | formats   | throws: ICU keeps these only for old messages |
| `<b>bold</b>`                                                                                   | text      | a tag, as in FormatJS                         |
| `{year}`, with 2024                                                                             | `2,024`   | `2024`, as a template literal prints it       |
| `{d, time, ::hhmm}`, at 3:04                                                                    | `3:04 AM` | `03:04 AM`, as `Intl`'s 2-digit hour          |

An invalid message throws a `SyntaxError` with the kind of error as its
`code` and its place as its `location`.

Every difference from ICU4C 78.3 is listed with its reason in
`src/__tests__/icu4c-messages.test.ts` and `icu4c-conformance.test.ts`, which
check about 3,500 cases.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
