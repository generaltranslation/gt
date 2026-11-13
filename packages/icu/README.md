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

A message follows ICU and Intl, by five rules. An earlier rule wins over a
later one:

1. ICU decides what a message means: its syntax, and what each type, style
   and skeleton asks for.
2. Intl formats the values. This package has no locale data of its own and
   does not emulate ICU.
3. Where Intl has no option for what a message asks for, formatting throws
   rather than print something else. A `RangeError` names the token or
   field. A message that is not valid throws a `SyntaxError`, with the kind
   of error as its `code` and the place in the message as its `location`.
4. What a message leaves unsaid, like how to round a tie, is Intl's default,
   not ICU's. So is how Intl prints what it has an option for, like a date
   before 1582.
5. Values are not coerced. A number, a plural and a selectordinal take a
   number, a bigint or a numeric string; a date and a time take a Date or a
   number; a select takes a string. Any other value throws a `TypeError`.

A few things are read differently from ICU on purpose:

- What ICU keeps only for old messages is an error: a pattern as a style,
  like `{d, date, yyyy-MM-dd}`, `choice`, a type in capitals, a branch key
  written twice, and a value that was not given.
- `<b>…</b>` is a tag, as in FormatJS. ICU reads it as text.
- A plain `{name}` reads a value as its text, as a template literal does,
  so `{year}` is `2024` and not `2,024`. A Date has no such text: it formats
  as the locale's short date and time, as in ICU.
- `hh` and `HH` pad the hour, as Intl's `2-digit` hour does, which is what a
  message tree holds for them. ICU pads as the locale's own pattern does.

`src/__tests__/icu4c-messages.test.ts` and `icu4c-conformance.test.ts` format
about 3,500 cases and check each result against what ICU4C 78.3 prints for it.
They hold every difference, each with its reason. A new difference needs a
reason there, and one of the rules above to stand on.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
