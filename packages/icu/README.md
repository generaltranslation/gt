# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages. Formatting relies on the host's `Intl` implementation;
no locale-data polyfills are shipped.

## Entry points

- `@generaltranslation/icu`: message trees, without the parser.
  `formatMessageTree()`, `validateMessageTree()` and `isMessageTree()`.
- `@generaltranslation/icu/convert`: `icuToMessage()` reads an ICU string as
  a message, `messageTreeToIcu()` prints a message tree as an ICU string, and
  `checkTranslation()` checks a translation against its source.
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

The formatters take every argument: the locales, the values, and the time
zone of dates and times. This package applies no defaults to them and does
not read the host's time zone; its caller passes them in.

## ICU compatibility

An ICU string means here what it means in ICU4C.
`src/__tests__/icu4c-conformance.test.ts` formats about 2,200 cases and
checks each result against what ICU4C 78.3 prints for it. Formatting is done by
the host's `Intl`, so some results differ, in the three ways below. The test
holds the complete list.

### Intl's defaults

What a message leaves out is filled in by Intl, not by ICU:

| A message that leaves out                                     | ICU4C                     | Here                                         |
| ------------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| how to round a tie, like 2.5 in `{n, number, integer}`        | to the even digit: `2`    | away from zero: `3`                          |
| the fraction digits of a skeleton, like 0.0625 in `::percent` | up to six: `0.0625%`      | Intl's for the style, mostly three: `0.063%` |
| a date or time field, like `::z`                              | only the time zone: `UTC` | the date too: `5/6/2020, UTC`                |

Spell them out to get ICU's result: `rounding-mode-half-even`, or a precision
like `.######`. V8 also writes a plain space before AM and PM, where ICU4C
writes a narrow no-break space.

Intl also keeps at most 21 significant digits and 100 fraction digits, where
ICU4C keeps every digit that `@@@*`, `.00*` and `precision-unlimited` ask
for: `::@@@*` prints 123456789012345678901234567890n as
`123,456,789,012,345,678,901,000,000,000`, and `::.00*` prints 1e-101 as
`0.00`.

### What Intl cannot format

Reading any of these throws a `RangeError` that names the token or field.
Nothing is skipped or formatted as something else.

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
  - `group-thousands` and `decimal-always`.
- Date and time skeletons:
  - quarters, weeks, the day of the year and week-based years: `Q`, `w`, `W`,
    `D`, `F`, `Y`, `u`, `U`, `r`, `g`, `A`;
  - a numeric or two-letter weekday (`e`, `EEEEEE`) and a zero-padded year
    (`yyyyy`);
  - `a` without an hour, narrow AM and PM (`aaaaa`), and `b`;
  - the hours `J` and `C`;
  - more than three fractional second digits (`SSSS`);
  - ISO and location time zones: `Z`, `V`, `X`, `x`.
- A pattern as a style, like `{n, number, #,##0.00}` or
  `{d, date, yyyy-MM-dd}`. A style is one of ICU's names or a `::` skeleton.
- The types `spellout`, `ordinal`, `duration` and `choice` (a `SyntaxError`).

### Read differently on purpose

- `{name}` prints its value as JavaScript does, as in FormatJS. ICU4C formats
  a number or a date there for the locale (`1,234.5`). Write `{n, number}`.
- `<b>…</b>` is a tag, as in FormatJS. ICU4C reads it as text.
- `{n, number, currency}` takes its currency from `formats`. ICU4C takes the
  locale's.
- `{t, time, ::jB}` shows the day period, `11 at night`, because that is how
  a message tree prints an hour with a day period. ICU4C shows `11 PM` for
  `j` with `B`; both show the day period for `hB`.
- A fraction combined with significant digits and no priority, like
  `.00/@##`: ICU4C pads the result to the fraction's minimum, `1,230.00`,
  and Intl does not, `1,230`. With the priority, `.00/@##s`, both print
  `1,230`.
- `precision-currency-standard` on a number that is not a currency changes
  nothing. ICU4C rounds it to two digits.

A skeleton ICU4C rejects is rejected here too in most cases, such as an unknown
token or the same setting twice (`.00 .##`). An unknown numbering system is
not: Intl falls back to the locale's.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
