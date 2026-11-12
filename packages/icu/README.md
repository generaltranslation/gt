# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages. Formatting relies on the host's `Intl` implementation;
no locale-data polyfills are shipped.

## Entry points

- `@generaltranslation/icu`: message trees, without the parser.
  `formatMessageTree()`, `validateMessageTree()` and `isMessageTree()`.
- `@generaltranslation/icu/convert`: `icuToMessage()` reads an ICU string as
  a message, `messageToIcu()` prints a message as an ICU string,
  `messageTreeToIcu()` prints its tree alone, and `checkTranslation()` checks
  a translation against its source.
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
variables, the same styles, and no formatting context of its own. Given the
translation's locale, it also checks that each plural has a branch for every
category the locale has, since a value with no branch for its category falls
back to `other` and reads wrong:

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

The formatters take every argument: the locales, the values, and the time
zone of dates and times. This package applies no defaults to them and does
not read the host's time zone; its caller passes them in.

## ICU compatibility

An ICU string means here what it means in ICU4C, the reference
implementation. Two tests hold ICU4C 78.3's own output and check every result
against it:

- `src/__tests__/icu4c-messages.test.ts`: about 1,250 messages over every
  part of the format (syntax and quoting, plural and select, numbers, dates
  and times) in more than 50 locales;
- `src/__tests__/icu4c-conformance.test.ts`: about 2,200 number and date
  skeletons in English.

A message that does not print what ICU4C prints has one of the reasons below.
The first test names the reason of each such message, so the list is complete
for what it covers. Most of them throw an error that says what to write
instead; the ones that print something else are marked **prints**.

### Left out of ICU on purpose

ICU keeps these so that old messages still work. A new message does not need
them, and each one hides a mistake or ties a message to one locale.

| In ICU4C                                                                                                                           | Here                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A pattern as the style: `{n, number, #,##0.00}`, `{d, date, yyyy-MM-dd}`. ICU discourages it: a pattern is written for one locale. | An error. Write a name or a `::` skeleton.       |
| `choice`, which ICU deprecates                                                                                                     | An error. Write a `plural` or a `select`.        |
| A type or style in any case: `{n, NUMBER}`, `{d, date, SHORT}`                                                                     | An error. ICU's grammar spells them lower case.  |
| A branch key written twice: the first is used, the second never                                                                    | An error.                                        |
| A value that was not given: the reader sees `{name}`                                                                               | An error.                                        |
| An empty style or skeleton, `{n, number, }` or `::`: read as no style                                                              | An error.                                        |
| A letter that is no field in a date skeleton, `::yMMMdT`: skipped                                                                  | An error.                                        |
| `=1.5`, `offset:0.5`, and `=N` past 2^53                                                                                           | An error. A plural counts whole things.          |
| A no-break space inside a name or a branch key                                                                                     | An error. A name has no white space of any kind. |
| Nesting up to 1,023 levels                                                                                                         | At most 64, then an error.                       |
| Numbered arguments, with no `{01}` and none past 32767                                                                             | A name is a key of the values, digits or not.    |
| The plural category taken from how the first `{n, number, integer}` in the branch prints: 1.4 is `one`                             | **Prints** the category of the value: `other`.   |

`DOUBLE_REQUIRED`, the apostrophe mode of the JDK, is not there either. An
apostrophe quotes as in ICU's default mode: only before `{`, `}` and, in a
plural, `#`.

### What Intl cannot format

Formatting is done by the host's `Intl`. Reading any of these throws an error
that names the token, field or type. Nothing is skipped or formatted as
something else.

- The types `spellout`, `ordinal` and `duration`, which need rule-based
  number formats. For 1st and 2nd, write a `selectordinal`.
- Number skeletons:
  - `permille`, and any unit Intl does not have;
  - `per-measure-unit/…` (write the whole unit: `unit/meter-per-second`);
  - `unit-width-hidden`, `unit-width-formal` and `unit-width-variant`;
  - `precision-currency-cash`, and an increment Intl does not round to, like
    `precision-increment/0.3`;
  - `rounding-mode-half-odd` and `rounding-mode-unnecessary`;
  - digits or a sign for the exponent: `E00`, `scientific/sign-always`;
  - a maximum of integer digits, or none: `integer-width/##0`,
    `integer-width/*`, `integer-width-trunc`;
  - `group-thousands` and `decimal-always`;
  - more than 21 significant digits.
- Date and time skeletons:
  - quarters, weeks, the day of the year and week-based years: `Q`, `w`, `W`,
    `D`, `F`, `Y`, `u`, `U`, `r`, `g`, `A`;
  - a numeric or two-letter weekday (`e`, `EEEEEE`) and a zero-padded year
    (`yyyyy`);
  - `a` without an hour, narrow AM and PM (`aaaaa`), and `b`;
  - the hours `J` and `C`;
  - more than three fractional second digits (`SSSS`);
  - ISO and location time zones: `Z`, `V`, `X`, `x`.
- An int64 past 2^53 in a plural with categories, or times a `scale` that is
  not a power of ten: Intl would round it.
- An invalid date. ICU4C prints nothing for it.

A `scale` that takes a number past the largest double **prints** `∞`.

### Intl's defaults

What a message leaves out is filled in by Intl, not by ICU. All of these
**print**:

| A message that leaves out                                     | ICU4C                     | Here                                         |
| ------------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| how to round a tie, like 2.5 in `{n, number, integer}`        | to the even digit: `2`    | away from zero: `3`                          |
| the fraction digits of a skeleton, like 0.0625 in `::percent` | up to six: `0.0625%`      | Intl's for the style, mostly three: `0.063%` |
| a date or time field, like `::z`                              | only the time zone: `UTC` | the date too: `5/6/2020, UTC`                |

Spell them out to get ICU's result: `rounding-mode-half-even`, or a precision
like `.######`. Intl also picks some patterns differently:

- `hh` and `HH` pad the hour, as UTS #35 defines them: `03:04 AM`. ICU4C
  pads as the locale's own pattern does, however many letters are written,
  so it prints `3:04 AM`. With one letter the two agree: German `::jmm` is
  `03:04` and Japanese `3:04`.
- `yyyy` does not pad a year before 1000: `12`, where ICU4C prints `0012`.
- Before 15 October 1582, ICU4C counts in the Julian calendar and V8 in the
  Gregorian.
- Spanish groups a number from five digits, so 1234 is `1234`. ICU4C's
  `{n, number}` prints `1.234`, and its own skeletons print `1234`.
- V8 writes a plain space before AM and PM, where ICU4C writes a narrow
  no-break space.

In a skeleton, `h` and `K` are the 12-hour clock the locale prefers, which
starts at 0 in Japanese, and `H` and `k` the 24-hour clock, as in ICU4C.

### Read differently on purpose

- `{name}` **prints** its value as JavaScript does, as in FormatJS. ICU4C
  formats a number or a date there for the locale (`1,234.5`). Write
  `{n, number}`.
- `<b>…</b>` is a tag, as in FormatJS, so a tag needs its function, and an
  apostrophe before `<` or `>` quotes. ICU4C reads all of it as text. `<br/>`
  and `<br />` are text here too, kept as written.
- A value of another type is converted as Intl converts it, and **prints**: a
  numeric string is a number, and a number picks the `select` branch of its
  digits. ICU4C fails.
- `{n, number, currency}` takes its currency from `formats`: a locale does
  not say what an amount is in. ICU4C takes the locale's.
- `{t, time, ::jB}` shows the day period, `11 at night`, because that is how
  a message tree prints an hour with a day period. ICU4C shows `11 PM` for
  `j` with `B`; both show the day period for `hB`.
- A fraction combined with significant digits and no priority, like
  `.00/@##`: ICU4C pads the result to the fraction's minimum, `1,230.00`,
  and Intl does not, `1,230`. With the priority, `.00/@##s`, both print
  `1,230`.
- `precision-currency-standard` on a number that is not a currency changes
  nothing. ICU4C rounds it to two digits.
- An unknown numbering system falls back to the locale's. ICU4C rejects it.
- A message tree does not take a date field in a time, like
  `{t, time, ::yMMMd}`: `checkTranslation` and `icuToMessage` reject it.

A skeleton ICU4C rejects is rejected here too in most cases, such as an
unknown token or the same setting twice (`.00 .##`).

### Errors

A syntax error is a `SyntaxError` whose message says what is wrong and what to
write. Its `code` is the kind of error, like `MISSING_OTHER_CLAUSE`, its
`location` the place in the message, and `originalMessage` the message.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
