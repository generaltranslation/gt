# @generaltranslation/icu

## 0.2.0-samsara.6

### Minor Changes

- fe7b0cc: The README states the rules a message follows where ICU and Intl disagree, and the formatter now keeps them where it did not.

  **Breaking:** values are no longer coerced. A number, a plural and a selectordinal take a number, a bigint or a numeric string; a date and a time take a Date or a number; a select takes a string. Any other value throws a `TypeError`. An empty string or `null` printed `0` or `Jan 1, 1970`, `"abc"` printed `NaN`, a Date in a number printed its milliseconds, and a select read `true` or `1` as the text `"true"` or `"1"`.

  Closer to ICU4C:
  - A Date in a plain `{d}` is the locale's short date and time in the time zone the formatter is given, like `06/05/2020 23:30` in French. It was `String(date)`: English, in the host's time zone.
  - An era or a time zone name with no other field is that field: `{d, time, ::z}` is `UTC`, not `5/6/2020, UTC`. This also holds for `date()` and `time()` with only `era` or only `timeZoneName`.
  - `precision-currency-standard` on a number without a currency rounds to two fraction digits. It changed nothing.

  Errors instead of another output:
  - A numbering system Intl does not have, like `::numbering-system/bogus`, is a `RangeError`. It was formatted with the locale's.
  - A fraction with a minimum beside significant digits, like `::.00/@##`, is a `RangeError`: ICU pads it to the minimum and Intl does not. With a priority, as `::.00/@##s`, it formats as before.
  - A number past the largest double is a `RangeError`, whether a `scale` takes it there or it is a numeric string like `"1e400"`. It printed `∞`. A bigint of any size still formats exactly.
  - An era and a time zone name with no other field, like `::Gz`, are a `RangeError`. Intl added the date to them.

### Patch Changes

- 2a5fe85: `checkTranslation` and `checkIcuTranslation` hold a plural's count to its tag. Where every `#` of a plural is inside a tag in the source, a `#` the translation writes must be inside that tag too, as in `"n" is not inside <b>, as it is in the source`. A tag may still move from around a plural into each of its branches, and a branch may leave `#` out.
- 2a5fe85: `validateMessageTree` and `isMessageTree` count a level that holds only text toward the nesting limit, as the parser does. A tree with text nested 65 levels deep passed the check and then could not be read back from its own ICU message.

## 0.2.0-samsara.5

### Minor Changes

- b1b9d26: `checkTranslation` and `checkIcuTranslation` now check where a variable is shown:
  - A reader who sees a variable in the source must see it in the translation. A variable may still repeat, and move into every branch of a select or plural or out of them; moved into one branch only, it is a problem, as in `"n" is not shown when g is other, as it is in the source` and `"folder" is not shown in every branch, as it is in the source`. A reader has one branch of each select and plural, so a variable split across two selects on one value is still shown to all. With a locale, a plural branch the locale never picks is left out.
  - A variable that is inside a tag at every use in the source must stay inside that tag, as in `"name" is not inside <b>, as it is in the source`. Moving a variable into a tag, splitting a tag, nesting tags another way, and moving a tag from around a select or plural into each of its branches are still allowed.

  **Breaking:** a translation that moved a variable into one branch, or out of its tag, was accepted and is now a problem.

  A style name or skeleton used where the source has one pattern now says what may stand in for it: `"d" uses {d, date, long}, where the source has {d, date, MM/dd/yyyy}: keep it or localize its pattern`.

### Patch Changes

- 27c26cd: Checking whether a string is a decimal number no longer takes quadratic time on a long run of digits. This affects string values formatted with a `scale` and the `scale` option of a number skeleton; the strings accepted are the same.

## 0.2.0-samsara.4

### Minor Changes

- 930e443: `checkIcuTranslation(sourceIcu, translationIcu, { locale })` checks a translated ICU string from any library against its source, by the same rules as `checkTranslation`, which checks a message tree.
  - It reads any ICU the parser reads. A style name or a skeleton is kept as written, and a skeleton is compared by its tokens or fields, so spacing is no change. A pattern, like `{d, date, MM/dd/yyyy}`, or an app's own style name, is the translator's to localize: where the source uses one, the translation may use any pattern in its place.
  - A source that is not valid ICU throws the parser's `SyntaxError`. A translation that is not valid ICU is a problem with it: its parser message is returned.

  `checkTranslation` now checks branch keys too:
  - Every exact `=N` branch the source has for a plural must be in the translation, as in `"n" is missing the exact branch =0, which the source has`. Adding one is still allowed.
  - A select's keys must be the source's, compared across all uses of the variable: `"g" is missing the select branch female` and `"g" has the select branch femenino, which the source does not`.
  - A plural branch that is no CLDR category, like `lots`, is reported without a `locale` too.
  - Keys only inside a plural category branch the locale does not have, and so may be left out, are not required.

- 8dde4bb: Rename `formatMessage` in `@generaltranslation/icu/parser` to `formatIcu`, and its options type `FormatMessageOptions` to `FormatIcuOptions`. It formats an ICU string, and the name now says so, like `icuToMessage` and `messageToIcu`. `@generaltranslation/icu/convert` no longer exports the `IcuMessage` type: `messageToIcu` returns `{ icu, formats }` as before. Nothing else changes: `formatMessage` in `@generaltranslation/format` and `generaltranslation` keeps its name and behavior.
- 84d0104: `validateMessageTree` and `isMessageTree` now reject four kinds of tree that passed before. Neither `templateToMessage` nor `icuToMessage` makes any of them:
  - A `select`, `plural` or `selectordinal` without an `other` branch. Formatting it threw for any value that matched no branch.
  - `0`, the plural count, outside a plural or selectordinal branch. It formatted as nothing, and printed as a `#` that ICU reads back as text.
  - A variable name, tag name or branch key that ICU cannot write, such as an empty name or one with a space. The tree printed as an ICU string that does not parse.
  - A plural offset that is not a safe integer, such as `0.5`. The parser reads only whole offsets, and formatting a bigint count with a fractional one threw.

  A tree built by `templateToMessage` or read by `icuToMessage` is unaffected. A hand-written translation in one of these forms is now invalid, and the runtime renders the source message in its place.

## 0.2.0-samsara.3

### Minor Changes

- 7ef8d91: ICU dates and times format as ICU does. The named styles, as in `{d, date, medium}` and `{t, time, short}`, use Intl's `dateStyle` and `timeStyle`, and a date or time without a style is the medium style: `{d, date}` is `May 6, 2020` in `en-US`, not `5/6/2020`. Skeletons read `S` as fractional seconds, `B` as the day period and `O` or `v` as the time zone name, and `::unit/` keeps a compound unit such as `kilometer-per-hour`.
- 7ef8d91: Names now follow one rule: a message is a tree and its `formats`, and a message tree is the tree alone.
  - `/internal`: `buildMessageTree` is `templateToMessage`, beside `icuToMessage`, since both return a message; its result type `BuiltMessageTree` is `TemplateMessage`.
  - `MessageTreeValues` is `MessageValues`: values are not part of the tree.

- 3c013b5: `@generaltranslation/icu` and `@generaltranslation/format` share one cache of Intl formatters, and take what they format with as arguments.
  - `formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Messages that format a number, a plural or a date render about 20 times faster.
  - `@generaltranslation/icu` and `@generaltranslation/format` apply no defaults to their own parameters and read neither the host's time zone nor the clock. The `locales`, a message's `variables`, the `timeZone` of dates and times, and the `baseDate` of `formatRelativeTimeFromDate` are required, as are `LocaleConfig`'s `defaultLocale`, `locales` and `timeZone`.
  - `generaltranslation` is the only package that resolves what a caller leaves out: its formatting functions and `LocaleConfig` keep their optional arguments, and it reads the host's time zone, once for the process. gt-i18n formats through it and no longer fills in a default itself.
  - The cache holds at most 256 instances of each constructor. It had no limit.
  - gt-i18n cuts an ICU message with `$maxChars` using the terminator of its locale, as it does a plain string. It used the English one.

- c7ae5e3: Whole messages are checked against ICU4C, and every difference has a stated reason.

  `icu4c-messages.test.ts` formats about 1,250 messages over every part of the format, in more than 50 locales, and checks each against ICU4C 78.3's output. A message that does not print what ICU4C prints names its reason there.

  Closer to ICU4C:
  - A left-to-right or right-to-left mark next to a name, a type or a branch key is white space, as in ICU. With a right-to-left mark before and after it, `{name}` asked for a value whose name ended in the mark.
  - An exact plural selector matches by number: `=01` and `=+1` are `=1`. They were compared as text, so they never matched 1.
  - `h` in a skeleton is the 12-hour clock the locale prefers, so `::hm` at half past midnight is `午前0:30` in Japanese, not `午前12:30`. `K` reads as `h` and `k` as `H`, as ICU matches them: `::Km` is `12:30 AM` and `::km` is `00:30` in English.
  - An hour with one letter is padded as the locale pads it, whatever the minute is written as: `::jmm` and `::Hmm` are `03:04` in German, not `3:04`. This also holds for `time()` with `hour: 'numeric'` and `minute: '2-digit'`.
  - `scale` with a power of ten is exact: `::scale/0.1 precision-unlimited` formats 3 as `0.3`, not `0.30000000000000004`, and a numeric string the same way. It also scales an int64 by a fraction.
  - `<br />` keeps its space. It was printed as `<br/>`.
  - `currency/EUR base-unit` is an error, as two unit settings are in ICU.

  Errors instead of wrong output:
  - A value is found only among the values given: `{toString}` with no value is an error, where it printed a function. Values inherited from a prototype are no longer read.
  - A message nests at most 64 levels of branches and tags, the limit a message tree already has. Deeper nesting overflowed the stack near 1,000 levels.
  - `plural()` and `select()` branch keys spell an exact number one way: `=1`, not `=01`, and `validateMessageTree` rejects a tree that spells one otherwise.

  Clearer errors:
  - A syntax error's message says what is wrong and what to write, like `choice is deprecated in ICU: write a plural or a select.` The kind of error, like `INVALID_ARGUMENT_TYPE`, was the message and is now the error's `code`.

- 7ef8d91: Message trees convert to ICU and back without loss.
  - Each `number`, `date` and `time` option is either a message option, kept in the tree (`style`, `unit`, date and time fields), or formatting context (`currency`, digits, `timeZone` and the rest). A date's or a time's named style is `style`, as for a number: `{ style: 'medium' }`, not Intl's `dateStyle` or `timeStyle`. `templateToMessage` returns the context as `formats`, and `formatMessageTree(tree, locales, values, { formats, timeZone })` applies it. `formats` is required, `{}` when a message has none; `formatMessage`, for an ICU string, takes no `formats`.
  - A message, branch or tag without placeholders is one string: `MessageTree` is `string | MessageNode[]`.
  - `icuToMessageTree(icu)` is now `icuToMessage(icu)` and returns a `Message`, `{ tree, formats }`. Any ICU string the parser reads converts: the formatting context it spells, like `::currency/EUR .00`, an hour cycle or `scale/100`, goes to `formats` by variable, so the same sentence in two currencies is one tree. `styles` passes the app's own style names, in the shape of react-intl's `formats` prop. It takes no source, and `findConflictingFormat` is removed.
  - The new `checkTranslation(source, translation, { locale })` compares a translation's variables and styles with its source. The translation is the `Message` that `icuToMessage` reads, and formatting context it sets, like a currency or an hour cycle, is reported: a translation cannot set any.
  - The `MessageVariables` type is removed: `MessageValues<R>` types the values of `formatMessage` and `formatMessageTree`.

- 884e499: `messageToIcu(message)` prints a message as an ICU string, the other way from `icuToMessage`.
  - It writes the tree and the formatting context a skeleton can spell: a currency, digits, a notation, grouping, a sign, a numbering system or an hour cycle. `{ tree: ['Total: ', ['total', 'number', 'currency']], formats: { total: { currency: 'EUR', maximumFractionDigits: 0 } } }` prints as `Total: {total, number, ::currency/EUR precision-integer}`.
  - It returns `{ icu, formats }`. `formats` is the context ICU has no syntax for, like a time zone or a calendar. `icuToMessage(icu)` reads the same tree back, and its `formats` with the returned ones are the message's.
  - `messageTreeToIcu(tree)` still prints the tree alone, which is what a translator sees. It now prints a percent unit as `::percent`, where it printed `::unit/percent`; both read back as the same tree.

- a186111: `checkTranslation` checks a translation's plural branches against its locale.

  Given a `locale`, each `plural` and `selectordinal` needs a branch for every category the locale has. A value with no branch for its category falls back to `other` and reads wrong: a Russian translation with only `one` and `other` prints `2 файлов`, not `2 файла`. It was accepted; it is now reported as `"n" is missing the plural branches few, many, which ru needs`.
  - A branch that is no CLDR category, like `lots`, is reported too.
  - A category the locale does not have, like `one` in Japanese, may still be left out or kept: it is never chosen.
  - Exact branches like `=0` are not part of this check.
  - Without a `locale`, or with one `Intl` has no plural rules for, no branch is checked. `Intl` would otherwise answer for the host's language, which also applied to the categories a translation may leave out.

- 2eadfe1: Number and date skeletons mean what they mean in ICU4C, or they throw.
  - Number skeleton tokens that FormatJS reads differently from ICU now have ICU's meaning. `percent` no longer multiplies by 100, so `{n, number, ::percent}` formats 0.256 as `0.256%`, not `26%`; `%x100` is the one that multiplies. `unit-width-short` is the currency symbol and `unit-width-iso-code` is the code. `group-min2`, `group-on-aligned`, `numbering-system/…`, `latin`, `sign-negative`, `sign-accounting-negative`, `precision-increment/…`, `precision-unlimited`, `.00*`, `@@@*` and a trailing `/w` are read instead of ignored. `E0` sets no integer digits, and `scale/0` multiplies by 0.
  - A token or field ICU formats and Intl cannot throws a `RangeError` that names it, where it was ignored or formatted as something else: `permille`, `unit-width-hidden`, `precision-currency-cash`, `decimal-always`, digits or a sign for the exponent (`E00`), the date fields `A`, `C`, `J`, `g`, `EEEEEE`, `yyyyy` and `SSSS`, and `a` without an hour.
  - A token that is not ICU's throws a `SyntaxError`, as does a setting given twice (`.00 .##`). They were ignored.
  - A style that is not one of ICU's names, like `{n, number, #,##0.00}`, throws when formatted. ICU reads it as a pattern, which is not supported; it was formatted with the default style.
  - `a` beside an hour adds nothing to it: `::Ha` is a 24-hour clock, as in ICU, not a 12-hour one.
  - The weekdays `eee`, `eeee` and `eeeee` (and `c`) are short, long and narrow, as in ICU.

  The rounding and the fraction digits a message leaves out are still Intl's. `icu4c-conformance.test.ts` checks about 2,200 cases against ICU4C 78.3's output, and holds every difference with its reason.

- b7fdac5: A message has one valid tree, so it has one key.
  - `validateMessageTree` and `isMessageTree` reject the other forms of a message: plain text in an array (`['Save']` for `'Save'`), text split in pieces or empty text in an array, a plural offset of 0, a `null` style, and entries past the ones a node's kind has. `templateToMessage` and `icuToMessageTree` never wrote these. The order of keys is still free.
  - `messageTreeToIcu` prints a valid tree as it is; it no longer rewrites other forms first.
  - The message tree types tell every node apart by its second element, so `switch (node[1])` narrows a node without a cast.

## 0.2.0-samsara.2

### Patch Changes

- b2aaf5e: `icuToMessageTree(translation, { source, locale })` takes the translation's locale. Following CLDR, a translation uses only its locale's plural categories, so it may leave out a category the locale does not have, such as `one` in Japanese, together with variables the source uses only there. Categories come from `Intl.PluralRules` (ordinal categories for `selectordinal`). A variable used anywhere else, including in an exact `=N` branch, a `select` branch, or a category the locale has, must still appear, and without `locale` every source variable is still required.

## 0.2.0-samsara.1

### Minor Changes

- 726168a: Move the ICU string parser to `@generaltranslation/icu/parser`. The root entry no longer exports `parse`, `formatMessage`, `printAST`, the syntax-tree types, `TYPE`, or `SKELETON_TYPE`; import them from `@generaltranslation/icu/parser` instead. `formatMessage` now parses to a message tree and formats it exactly like `formatMessageTree`, with the same types. This changes how plain values render in ICU strings, including through `formatMessage` in `@generaltranslation/format` and `generaltranslation` and the string API built on them: they format like a template literal, so `true` is `'true'`, `false` is `'false'`, and bigints and Dates in a plain `{value}` are text (`null` and `undefined` stay empty). Previously intl-messageformat's rules kept `true`, bigints and Dates as parts, which the string API joined with commas, as in `'before ,true, after'`.

  The root entry now ships without the parser and works with message trees, a compact JSON form of a message where text is a string, `#` is `0`, and each placeholder is a tuple such as `['count', 'plural', { one: [0, ' file'], other: [0, ' files'] }]`. It adds `formatMessageTree` for formatting them (plain values, Dates included, format as text, like a template literal, so the result is typed `string` unless a value is rich, such as a React element or a tag formatter's result), and `validateMessageTree` and `isMessageTree` for checking untrusted trees against the `MessageTree` type. The new `@generaltranslation/icu/internal` entry, shared by General Translation packages and not a public API, holds `buildMessageTree` for building canonical trees from template parts (template text is always literal, including `#`; a `pound` hole is the plural count) and `findConflictingFormat` for finding a variable with two formats ICU spells the same way, which a translation cannot tell apart. The new `@generaltranslation/icu/convert` entry converts ICU strings to message trees with `icuToMessageTree` and prints trees as ICU with `messageTreeToIcu`; printing writes Intl options as an ICU skeleton such as `::currency/USD` (or the named `percent` style) that `icuToMessageTree` reads back as the same format, so every ICU string it reads prints back, leaves out tree-only options with no ICU spelling (such as `timeZone`), and `icuToMessageTree(icu, { source })` restores those from the tree the string was printed from.

## 0.1.3-samsara.0

### Patch Changes

- 0604209: Seed the Samsara prerelease channel.

## 0.1.2-iris.0

### Patch Changes

- 5d8b78a: Migrate the package license from FSL-1.1-ALv2 to MIT.

## 0.1.2

### Patch Changes

- [#2074](https://github.com/generaltranslation/gt/pull/2074) [`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8) Thanks [@eoinest](https://github.com/eoinest)! - Migrate the package license from FSL-1.1-ALv2 to MIT.

## 0.1.1

### Patch Changes

- [#1993](https://github.com/generaltranslation/gt/pull/1993) [`e55aaa9`](https://github.com/generaltranslation/gt/commit/e55aaa9cfdf6dfe3ab96d0eea927f255b66cd20d) Thanks [@bgub](https://github.com/bgub)! - Reduce the shipped ICU runtime bundle and remove unnecessary formatting allocations.

## 0.1.0

### Minor Changes

- [#1929](https://github.com/generaltranslation/gt/pull/1929) [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Replace the FormatJS ICU parser and runtime formatter dependencies with the new dependency-free `@generaltranslation/icu` package.

## 0.0.1

### Minor Changes

- Initial dependency-free ICU MessageFormat parsing and formatting primitives.
