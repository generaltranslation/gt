# @generaltranslation/format

## 1.0.0-samsara.12

### Major Changes

- 1a8e58d: **Breaking:** the `<Branch>` component is now `<Select>`, the name of the `select()` helper, and its `branch` prop is now `value`. It renders as before.

  ```diff
  -import { Branch } from 'gt-react';
  -<Branch branch={role} admin="Administrator">Member</Branch>
  +import { Select } from 'gt-react';
  +<Select value={role} admin="Administrator">Member</Select>
  ```

  - In Vue, `<Branch :branch="role">` is `<Select :value="role">`; in Svelte, `<Branch branch={role}>` is `<Select value={role}>`.
  - `value` is no longer a branch name, and `branch` is one like any other.
  - The `BranchProps` type is `SelectProps`.
  - The lint rule `no-data-attrs-on-branch` is `no-data-attrs-on-select`.
  - The `static-jsx` fix imports a component as `GT<name>`, as in `Select as GTSelect`, when the file already has something of that name, such as a UI library's `Select`.
  - The compiler inserts `GtInternalSelect` where it inserted `GtInternalBranch`, so the compiler and the runtime packages must be upgraded together.
  - Stored content marks a select with `t: 's'` where it marked a branch with `t: 'b'`, so `GTProp['t']` from `@generaltranslation/format` is `'s' | 'p' | 'o'`. A `<T>` that holds a `<Select>` has a new hash and is translated again.

### Minor Changes

- 5b1c74c: `<Ordinal>` is `<Plural>` for ordinals such as 1st, 2nd and 3rd: it picks among the locale's ordinal categories, where `<Plural>` picks among its plural categories.

  ```jsx
  <Ordinal
    n={place}
    one={
      <>
        <Num>{place}</Num>st
      </>
    }
    two={
      <>
        <Num>{place}</Num>nd
      </>
    }
    few={
      <>
        <Num>{place}</Num>rd
      </>
    }
  >
    <Num>{place}</Num>th
  </Ordinal>
  ```

  In English this renders 1st, 2nd, 3rd, 4th, 11th, 21st and so on. Everything else is as in `<Plural>`: the category branches `zero`, `one`, `two`, `few` and `many`, exact branches such as `_1`, the children as the fallback, `<N />` for its count in React, and the same errors and warnings. A translation picks among its own branches with the target locale's ordinal rules: French has `one` and the fallback, and Welsh has all six categories.

  `gt-react`, `gt-react-native`, `gt-next` and `gt-tanstack-start` export it wherever they export `<Plural>`. `gt-vue` and `gt-svelte` have the same component: `<Ordinal :n="place" one="1st" two="2nd">nth</Ordinal>` in Vue, and `<Ordinal {n} one="first" two="second">later</Ordinal>` in Svelte, with slots and snippets for the branches as in `<Plural>`.

  `gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors read `<Ordinal>` as they read `<Plural>`: an `other` prop, slot or snippet and a spread attribute in translated content are errors. The `static-jsx` lint rule checks its branches as it checks those of `<Plural>`.

  Stored content marks an ordinal plural with `t: 'o'` in an element's GT data, beside `'p'` for a plural and `'s'` for a select, so `GTProp['t']` from `@generaltranslation/format` is now `'s' | 'p' | 'o'`. An `<Ordinal>` hashes differently from a `<Plural>` with the same branches.

### Patch Changes

- Updated dependencies [5b1c74c]
  - @generaltranslation/icu@1.0.0-samsara.10

## 1.0.0-samsara.11

### Patch Changes

- 622199e: Fix `formatListToParts` choosing a different connector than `formatList` for string and number items. A Spanish list now reads "Fernando e Isabel" and "7 u 8" instead of "Fernando y Isabel" and "7 o 8", and a Hebrew list attaches "ו" to a Hebrew word without a hyphen.
- 7d841de: `<N />` is the count of the `<Plural>` it is in, formatted as a number, as `#` is in ICU.

  ```tsx
  <Plural n={count} one='One file'>
    <N /> files
  </Plural>
  ```

  Use it instead of `<Num>{count}</Num>` for the count. A translation can then show the count in any branch: English `one` only covers 1, so "One file" has none, but Russian uses `one` for 21 and 31 too and renders "21 файл". `<N />` takes no props. With no `<Plural>` to give it a count, it is an error in development and renders nothing in production.

  It is stored as a variable of the new type `#`, which the runtime fills from the plural's `n` wherever a translation puts it.

- Updated dependencies [7d841de]
  - @generaltranslation/icu@1.0.0-samsara.9

## 1.0.0-samsara.10

### Major Changes

- c0f8d3d: **Breaking:** a variable in the content of a `<T>` is found by its id, and has a name only when its author gave it one. A variable component without a `name` used to get a generated one, such as `_gt_cost_2`.

  ```diff
  - { "i": 2, "k": "_gt_cost_2", "v": "c" }   // <Currency>
  + { "i": 2, "v": "c" }

    { "i": 3, "k": "price", "v": "c" }        // <Currency name="price">, unchanged
  ```

  - `i` identifies a variable among its siblings, as it does an element. The runtimes match a translated variable to its value by `i`, so two variables with the same `name` no longer render the same value.
  - `v`, the type, is always there, and is how a variable is told from an element. `Variable` in `@generaltranslation/format` is now `{ i: number; v: VariableType; k?: string }`.
  - `k` is only a label for translators. An empty `name` counts as none, in every runtime and extractor.
  - `hashSource` hashes a variable by its `v` and, when it has one, its `k`.

  Every `<T>` that holds a `<Var>`, `<Num>`, `<Currency>`, `<DateTime>` or `<RelativeTime>` without a `name` gets a new hash. The runtimes, `gt`, the compiler, the Next.js SWC plugin and the Vue and Svelte extractors all write the new form, so upgrade them together, then run `gt translate` again. Translations stored under the old hashes are no longer found, and a translated variable needs its `i`: local translation files need their keys and variables updated or regenerated. A `<T>` whose variables all have a `name`, or that has no variables, keeps its hash.

  gt-svelte's `_gtm` metadata no longer lists variable names.

### Minor Changes

- cdee423: `GTIntl` formats in one locale: the `locale` of the call, else of the instance, else the default locale. It no longer puts the default locale and `en` behind it as fallbacks.
  - A locale `Intl` has no data for formats in the host's locale, as `Intl` does on its own, where it used to format in the default locale. To keep that fallback, pass the list: `intl.formatNum(value, { locales: [locale, defaultLocale] })`. A call's `locales` reach `Intl` as they are.
  - A custom alias is still replaced by its code before it reaches `Intl`.

  Formatting a message tree through `GTIntl` is 2.4 times faster for a catalog that is mostly plain text, and 25% faster for one where every message has structure.

- b078069: The variable components `<Num>`, `<Currency>`, `<DateTime>` and `<RelativeTime>` take the same values and format the same way as `number()`, `date()` and `time()` in a `` t`…` `` message. In gt-vue and gt-svelte the value is the `value` prop where gt-react takes children.
  - `<Currency>` requires `currency`; it no longer defaults to `USD`: `<Currency>{price}</Currency>` → `<Currency currency="USD">{price}</Currency>`.
  - `<Num>` and `<Currency>` take a `number` or a `bigint`, not a string: `<Num>1000</Num>` → `<Num>{1000}</Num>`, `<Num>{text}</Num>` → `<Num>{Number(text)}</Num>`. gt-vue no longer renders text that is not a number as it is.
  - `<DateTime>` takes a `Date` or a timestamp, not a string: in gt-vue, `<DateTime value="2024-01-01" />` → `<DateTime :value="new Date('2024-01-01')" />`.
  - `<DateTime>` without a style or a date or time field in `options` formats in the medium date style, like `date(value)`: `Mar 14, 2024`, not `3/14/2024`. For the old output, pass `options={{ year: 'numeric', month: 'numeric', day: 'numeric' }}`.
  - `<DateTime>` keeps the direction marks of the formatted date, which it removed. The Arabic `14‏/3‏/2024` holds two right-to-left marks that keep its parts in order inside left-to-right text.
  - `<RelativeTime>` takes the date as children, like `<DateTime>`, and no longer has the `date` prop: `<RelativeTime date={date} />` → `<RelativeTime>{date}</RelativeTime>`. A count still takes `value` and `unit`.
  - The `currency` prop of `<Currency>` wins over `options.currency`.
  - The `locales` prop is removed from `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>` and gt-react's `<Plural>`. They format in the current locale, then the default locale. To format in another locale, call a formatter: `<Num locales={['de']}>{n}</Num>` → `{formatNum(n, { locales: ['de'] })}` with `formatNum` from `generaltranslation`, wrapped in `<Var>` inside a `<T>`.
  - `useFormatLocales()` takes no argument and returns the current locale, then the default locale: `useFormatLocales(['de'])` → `useFormatLocales()`. `getFormatLocales()` from `@generaltranslation/react-core/pure` no longer takes `localesProp`.
  - The prop types `NumProps`, `CurrencyProps`, `DateTimeProps` and `RelativeTimeProps`, and the props of `<Var>`, no longer have the internal `_locale` and `_enableI18n`; the `Resolved…Props` types still do.

  `formatNum()` and `formatCurrency()` from `generaltranslation` and `@generaltranslation/format` accept a `bigint`, and `formatDateTime()` accepts a timestamp, as do the `GTIntl` methods.

### Patch Changes

- c30676f: `GTIntl#requiresTranslation` decides once per configured locale. A `<T>` or variable render asks this once or twice, and each answer canonicalized both locales, at 1.5 to 2.3 µs; an answer for the default locale or one of `locales` now takes a few nanoseconds after the first. A locale that is not configured is still decided on every call, and results are unchanged.
- Updated dependencies [7b5075a]
- Updated dependencies [2eec421]
- Updated dependencies [48db495]
- Updated dependencies [48db495]
- Updated dependencies [984147d]
- Updated dependencies [63851ee]
- Updated dependencies [550e8ca]
- Updated dependencies [5cb51b4]
- Updated dependencies [b078069]
  - @generaltranslation/icu@1.0.0-samsara.8

## 1.0.0-samsara.9

### Major Changes

- ba09ee2: The `LocaleConfig` class is now `GTIntl`, and `LocaleConfig` is the plain-data type of its settings (`{ defaultLocale?, locales?, customMapping?, timeZone? }`). `GTIntl` also takes an optional target `locale`, the default for every call. Like the rest of this package, `GTIntl` here takes its settings as given: `defaultLocale` and `timeZone` are required (type `ResolvedLocaleConfig`). `GTIntl` from `generaltranslation` fills them in:
  - `new LocaleConfig({ defaultLocale, locales, customMapping })` → `new GTIntl({ defaultLocale, locales, customMapping }, { locale })`; `LocaleConfigConstructorParams` → `LocaleConfig`.
  - Formatters drop the positional target locale: `config.formatNum(n, 'es', options)` → `intl.formatNum(n, { ...options, locale: 'es' })`, and likewise for `formatCurrency`, `formatDateTime`, `formatList`, `formatListToParts`, `formatRelativeTime`, `formatRelativeTimeFromDate`, `formatMessage`, and `formatCutoff`.
  - `config.requiresTranslation(target, source)` → `intl.requiresTranslation({ locale: target, sourceLocale: source })`; without a locale it checks the instance `locale`, then `defaultLocale`. It checks against the configured `locales`: omitted `locales` still mean no restriction, but `locales: []` now approves no locale. For another approved list, construct a `GTIntl` with `locales: approved`.
  - `config.determineLocale(candidates, approved)` → `new GTIntl({ locales: approved, customMapping }).determineLocale(candidates)`; `intl.determineLocale(candidates)` matches against the configured `locales`.
  - `getLocaleName`, `getLocaleProperties`, `getLocaleEmoji`, and `getLocaleDirection` take an optional locale (default: the target locale) and `{ locale }`; names are in the target locale, which is `defaultLocale` without an instance or per-call locale.
  - New: `intl.getRegionProperties(region, { locale })` names the region in the target locale and reads names and emojis from the `regionCode` entries of `customMapping`.
  - `GTIntl` copies and freezes its configuration: `locales` and `customMapping` are readonly, and later changes to the objects you passed have no effect. `LocaleConfig.locales` accepts a readonly array.

- 3832c15: `determineLocale` now follows standard locale matching, selected by a new `localeMatcher` option (`'lookup' | 'best fit'`, default `'best fit'`) on `LocaleConfig`, `GTConfig`, gt-i18n's `I18nConfig` params, and gt-next's `withGTConfig` / `gt.config.json`. The `LocaleMatcher` type is exported next to `LocaleConfig` and limits the option to these values; gt-next, the gt CLI, the compiler and gt-react-native reject any other value when they load `gt.config.json` or `withGTConfig()` props.

  Requested and configured locales are canonicalized the same way (`customMapping` alias → code, invalid tags skipped, standardized; a requested tag only needs a valid language-script-region base, so extension and private-use subtags are allowed), and the result is always the configured spelling. `determineLocale` never applies `defaultLocale`; callers keep owning the fallback.
  - `'lookup'` (RFC 4647 §3.4 Lookup): for each requested locale in priority order, truncate it from the end (a single-letter subtag is removed with the subtag after it, so `zh-Hant-CN-x-private1-private2` → `zh-Hant-CN-x-private1` → `zh-Hant-CN` → `zh-Hant` → `zh`) and return the first configured locale equal to a truncation; `*` is skipped.
  - `'best fit'`: take the requested languages in order of first appearance. For each language, run Lookup over the requested locales of that language against the configured locales of that language, accepting only a match with the same likely script (`Intl.Locale.prototype.maximize`); if nothing matches, return the first configured locale of that language (configured order) whose likely script equals the script of a requested locale of that language, trying requested locales in order. If no configured locale of that language shares a script, plain Lookup applies, so `zh-TW` resolves to `zh-Hant` when it is configured and to a bare `zh` only when it is not. Then move to the next language. A region difference is acceptable; a script difference is not (no `sr-Latn` ↔ `sr-Cyrl` exception). Tags without a derivable script, such as `qaa`, compare as an empty script.

  The standalone `determineLocale(locales, approvedLocales, customMapping)` now delegates to `new GTIntl({ locales: approvedLocales, customMapping }).determineLocale(locales)`, so it resolves aliases and returns the configured spelling. It always uses `'best fit'`. gt-vue's `initializeGTSPA()` accepts `localeMatcher` too, so a `gt.config.json` object passed to it keeps its matcher.

  Behavior changes (before → after, default `'best fit'`):

  | Requested → configured                      | Before      | After       |
  | ------------------------------------------- | ----------- | ----------- |
  | ------------------------------------------- | ----------- | ----------- |
  | `en` → `en-GB, fr-FR`                       | `undefined` | `en-GB`     |
  | `['en', 'fr']` → `en-GB, fr-FR`             | `fr-FR`     | `en-GB`     |
  | `en-AU` → `en-GB`                           | `undefined` | `en-GB`     |
  | `['en-AU', 'en-GB']` → `en-US, en-GB`       | `en-US`     | `en-GB`     |
  | `zh-TW` → `zh-CN, en`                       | `zh-CN`     | `undefined` |
  | `sr-Latn` → `sr-Cyrl`                       | `sr-Cyrl`   | `undefined` |
  | `en` → `en-GB, en-US`                       | `en-US`     | `en-GB`     |
  | standalone, `brand-fr` aliased and approved | `brand-FR`  | `brand-fr`  |

- 943c094: `@generaltranslation/format/types` is removed. Import its types and `HTML_CONTENT_PROPS` from `@generaltranslation/format`.

### Patch Changes

- 82999f0: The root entry exports `getRegionProperties` and its types from their defining modules instead of through internal pass-throughs. No public API change.
- 96f428a: `determineLocale` fixes:
  - A requested tag with a variant subtag, such as `de-DE-1996`, now matches like its base tag: Lookup truncates it to `de-DE`. It used to match nothing.
  - With `localeMatcher: 'best fit'`, an earlier requested script wins over a later exact match in another script. `['zh-Hant', 'zh-CN']` against `['zh-CN', 'zh-TW']` now resolves to `zh-TW`; it used to resolve to `zh-CN`.

- 2d7f9bd: Remove runtime checks that TypeScript already guarantees and duplicated locale resolution. gt-react's browser condition store now resolves the locale once on initialization and server updates, and gt-vue's `initializeGTSPA()` builds its locale matcher once instead of on every lookup. Translation hashes do not change.

  Two observable changes:
  - `generaltranslation`: runtime translation results from the General Translation API are no longer shape-checked on the client; their type comes from the generated API client. A successful result whose `translation` did not match its `dataFormat` used to become `{ success: false, error: 'Invalid translation returned', code: 500 }`; it is now returned as the service sent it. Failed requests, missing entries (`'No translation returned'`) and network errors behave as before.
  - `gt-tanstack-start`: request locales are now resolved against the configuration that `initializeGT()` already loaded, instead of a copy rebuilt on every request. That configuration always includes `defaultLocale` among the supported locales, so with `defaultLocale: 'en'`, `locales: ['fr']` and `Accept-Language: en, fr`, the request locale is now `en` (previously `fr`), matching path-based locale detection.

- Updated dependencies [06ccdfd]
  - @generaltranslation/icu@0.2.0-samsara.7

## 1.0.0-samsara.8

### Patch Changes

- Updated dependencies [fe7b0cc]
- Updated dependencies [2a5fe85]
- Updated dependencies [2a5fe85]
  - @generaltranslation/icu@0.2.0-samsara.6

## 1.0.0-samsara.7

### Patch Changes

- 27c26cd: From `main` (`@generaltranslation/format` 0.1.10): configured locales are no longer revalidated on every `requiresTranslation` and `determineLocale` call when `customMapping` uses object entries with a `code`, which slowed server renders that look up many messages (#2718).
- Updated dependencies [b1b9d26]
- Updated dependencies [27c26cd]
  - @generaltranslation/icu@0.2.0-samsara.5

## 1.0.0-samsara.6

### Minor Changes

- 6440bd1: Remove the `IcuMessage`, `I18nextMessage` and `StringMessage` types from `@generaltranslation/format`, `@generaltranslation/format/types` and `generaltranslation/types`. Each was an alias of `string` and checked nothing; use `string`. `ContentByFormat`, `ContentFor`, `StringContent` and `Content` are unchanged.
- ada6894: Rename three names to match `GLOSSARY.md`. No behavior changes.
  - The `Message` type in `gt-i18n/types`, a string message with its metadata as passed to `getGT()` and `useGT()`, is now `RegisteredMessage`. `Message` is left to mean a message tree and its formats.
  - `hashMessage` in `gt-i18n/internal` is now `hashContent`: it hashes content in any data format, JSX included.
  - `LocaleConfig.formatMessageTree()` takes the data for its variables as `values`, not `variables`, as `formatMessageTree` does everywhere else. This also applies to `LocaleConfig` in `generaltranslation` and `I18nConfig` in `gt-i18n`.

### Patch Changes

- 8dde4bb: Rename `formatMessage` in `@generaltranslation/icu/parser` to `formatIcu`, and its options type `FormatMessageOptions` to `FormatIcuOptions`. It formats an ICU string, and the name now says so, like `icuToMessage` and `messageToIcu`. `@generaltranslation/icu/convert` no longer exports the `IcuMessage` type: `messageToIcu` returns `{ icu, formats }` as before. Nothing else changes: `formatMessage` in `@generaltranslation/format` and `generaltranslation` keeps its name and behavior.
- Updated dependencies [930e443]
- Updated dependencies [8dde4bb]
- Updated dependencies [84d0104]
  - @generaltranslation/icu@0.2.0-samsara.4

## 1.0.0-samsara.5

### Minor Changes

- 886232a: The data format of a message tree is named `MESSAGE_TREE`. It was `ICU_TREE`, which reads as the ICU parser's syntax tree, the one tree it is not; everything else already calls it a message tree (`MessageTree`, `formatMessageTree`, `messageTreeToIcu`).

  The name is part of what `hashSource` hashes, so every tagged-template message gets a new hash: regenerate the translations of `/unstable` messages. A server that still expects `ICU_TREE` rejects the new name, and the other way round.

## 1.0.0-samsara.4

### Minor Changes

- 7ef8d91: ICU dates and times format as ICU does. The named styles, as in `{d, date, medium}` and `{t, time, short}`, use Intl's `dateStyle` and `timeStyle`, and a date or time without a style is the medium style: `{d, date}` is `May 6, 2020` in `en-US`, not `5/6/2020`. Skeletons read `S` as fractional seconds, `B` as the day period and `O` or `v` as the time zone name, and `::unit/` keeps a compound unit such as `kilometer-per-hour`.
- 3c013b5: `@generaltranslation/icu` and `@generaltranslation/format` share one cache of Intl formatters, and take what they format with as arguments.
  - `formatMessage` and `formatMessageTree` cache the locale they resolve and the Intl formatters they build, instead of creating them on every call, and return a plain-text message tree as is. Messages that format a number, a plural or a date render about 20 times faster.
  - `@generaltranslation/icu` and `@generaltranslation/format` apply no defaults to their own parameters and read neither the host's time zone nor the clock. The `locales`, a message's `variables`, the `timeZone` of dates and times, and the `baseDate` of `formatRelativeTimeFromDate` are required, as are `LocaleConfig`'s `defaultLocale`, `locales` and `timeZone`.
  - `generaltranslation` is the only package that resolves what a caller leaves out: its formatting functions and `LocaleConfig` keep their optional arguments, and it reads the host's time zone, once for the process. gt-i18n formats through it and no longer fills in a default itself.
  - The cache holds at most 256 instances of each constructor. It had no limit.
  - gt-i18n cuts an ICU message with `$maxChars` using the terminator of its locale, as it does a plain string. It used the English one.

### Patch Changes

- Updated dependencies [7ef8d91]
- Updated dependencies [7ef8d91]
- Updated dependencies [3c013b5]
- Updated dependencies [c7ae5e3]
- Updated dependencies [7ef8d91]
- Updated dependencies [884e499]
- Updated dependencies [a186111]
- Updated dependencies [2eadfe1]
- Updated dependencies [b7fdac5]
  - @generaltranslation/icu@0.2.0-samsara.3

## 1.0.0-samsara.3

### Patch Changes

- Updated dependencies [b2aaf5e]
  - @generaltranslation/icu@0.2.0-samsara.2

## 1.0.0-samsara.2

### Minor Changes

- 4b6ea22: Message trees are a data format: `DataFormat` adds `'ICU_TREE'`, and `ContentByFormat` and `ContentFor` in `@generaltranslation/format/types` map each data format to its content, and `Content` covers every data format, message trees included. `hashSource` in `generaltranslation/id` hashes a message tree passed with `dataFormat: 'ICU_TREE'` like any other source, with its `context`, `maxChars` and `requiresReview`; object key order is ignored, and the format in the hashed data keeps tree keys apart from string and JSX keys. The API contract and runtime translation accept `ICU_TREE`.
- cc73381: Add experimental `gt-i18n/unstable` and `gt-i18n/unstable/internal` entries. Their API may change in any minor release and is not covered by semver. `t` is a tagged template (`` t`Hello, ${{ name }}!` `` or `` t({ context })`Save` ``) that builds a message tree from the template, hashes it with `hashSource`, and formats loaded tree translations without the ICU string parser. Helpers `plural`, `selectordinal`, `select`, `number`, `date`, `part`, `derive`, and `n` are exported from `gt-i18n/unstable`; framework packages use `createGT` and `getGT` from `gt-i18n/unstable/internal`. Missing tree translations render the source message and, in dev hot reload, are sent for runtime translation like string and JSX messages. Template text is always literal, including ICU syntax such as `#`. A bare value (`` t`Hi ${name}` ``) is an anonymous variable and `${{ name }}` a named one; either renders like a template literal (`true` as `'true'`, `12n` as `'12'`, `null` and `undefined` as nothing), and a `Date` is a type error that points to `date()`; helpers take either form, as in `plural({ count }, ...)` or `plural(count, ...)`. Plural and select branches are strings, or `part` templates when they hold placeholders, and a plain template literal with values in a branch is a type error; `n` is the count of the nearest plural (`` part`${n} items` ``). `derive()` inlines static text chosen in code; its argument must be typed as a string literal or a union of them, so the CLI can read every variant from the type.

  `Content` from `@generaltranslation/format/types` and `generaltranslation/types` replaces the `Translation` type, which `gt-i18n/types` no longer exports. Loaded catalogs, translation loaders, and the translations passed to React Core providers, gt-react-native's `LocaleTranslations`, and gt-svelte's `loadTranslations()` and `<GTProvider>` can hold message trees alongside string and JSX entries. Translation lookups and runtime translation take message trees with `$format: 'ICU_TREE'`, like any other format.

- 726168a: Move the ICU string parser to `@generaltranslation/icu/parser`. The root entry no longer exports `parse`, `formatMessage`, `printAST`, the syntax-tree types, `TYPE`, or `SKELETON_TYPE`; import them from `@generaltranslation/icu/parser` instead. `formatMessage` now parses to a message tree and formats it exactly like `formatMessageTree`, with the same types. This changes how plain values render in ICU strings, including through `formatMessage` in `@generaltranslation/format` and `generaltranslation` and the string API built on them: they format like a template literal, so `true` is `'true'`, `false` is `'false'`, and bigints and Dates in a plain `{value}` are text (`null` and `undefined` stay empty). Previously intl-messageformat's rules kept `true`, bigints and Dates as parts, which the string API joined with commas, as in `'before ,true, after'`.

  The root entry now ships without the parser and works with message trees, a compact JSON form of a message where text is a string, `#` is `0`, and each placeholder is a tuple such as `['count', 'plural', { one: [0, ' file'], other: [0, ' files'] }]`. It adds `formatMessageTree` for formatting them (plain values, Dates included, format as text, like a template literal, so the result is typed `string` unless a value is rich, such as a React element or a tag formatter's result), and `validateMessageTree` and `isMessageTree` for checking untrusted trees against the `MessageTree` type. The new `@generaltranslation/icu/internal` entry, shared by General Translation packages and not a public API, holds `buildMessageTree` for building canonical trees from template parts (template text is always literal, including `#`; a `pound` hole is the plural count) and `findConflictingFormat` for finding a variable with two formats ICU spells the same way, which a translation cannot tell apart. The new `@generaltranslation/icu/convert` entry converts ICU strings to message trees with `icuToMessageTree` and prints trees as ICU with `messageTreeToIcu`; printing writes Intl options as an ICU skeleton such as `::currency/USD` (or the named `percent` style) that `icuToMessageTree` reads back as the same format, so every ICU string it reads prints back, leaves out tree-only options with no ICU spelling (such as `timeZone`), and `icuToMessageTree(icu, { source })` restores those from the tree the string was printed from.

### Patch Changes

- Updated dependencies [726168a]
  - @generaltranslation/icu@0.2.0-samsara.1

## 1.0.0-samsara.1

### Major Changes

- bb107a8: Remove `typesVersions`. Subpath types such as `gt-next/server` now resolve only through `exports`, which needs `moduleResolution` `bundler` (TypeScript 5.0+) or `node16`/`nodenext` (TypeScript 4.7+). `moduleResolution` `node` (node10) is no longer supported, including its implicit use with `module: commonjs` in TypeScript 5.9 and earlier and in create-next-app projects from Next.js 13.4.10 and earlier.

## 0.1.10

### Patch Changes

- [#2718](https://github.com/generaltranslation/gt/pull/2718) [`7aae545`](https://github.com/generaltranslation/gt/commit/7aae545bd9e65148b8cbf98a4df3ce750ab1cdbf) Thanks [@eoinest](https://github.com/eoinest)! - fix(format): stop revalidating configured locales on every `requiresTranslation` and `determineLocale` call when `customMapping` uses object entries with a `code`, which slowed server renders that look up many messages

## 0.1.10-samsara.0

### Patch Changes

- Updated dependencies [0604209]
  - @generaltranslation/icu@0.1.3-samsara.0

## 0.1.9

### Patch Changes

- [#2288](https://github.com/generaltranslation/gt/pull/2288) [`90109bf`](https://github.com/generaltranslation/gt/commit/90109bf9ec4900819023176320629a5069fd7b51) Thanks [@eoinest](https://github.com/eoinest)! - Preserve configured locale identities across negotiation, routing, hooks, cookies, translation loaders, and caches, including when GT services are enabled. For example, configuring `en-gb` keeps that spelling in application-facing values while GT service requests and formatting use `en-GB`.

  Locale negotiation accepts equivalent spellings and returns a configured identity, preserving exact matches between distinct aliases for the same language. This also applies to request-header negotiation: an `Accept-Language` preference of `fr` can resolve to a configured `brand-french` alias. Preserve support for legacy tags such as `sh` and `cnr`, and retain existing custom mappings when validating partial `setConfig()` updates.

  Translation loaders and local filenames must use the configured identity: a loader for configured `en-gb` receives `en-gb`, not `en-GB`. Configure canonical spelling instead if the application requires it. Custom mapping `code` values must use canonical spelling, for example `'en-gb': { code: 'en-GB' }`. Canonicalize locales at GT service boundaries, including nested source-file locales in translation uploads and requests through the shared CLI/Sanity adapter. Require canonical locale codes or explicit custom mappings for CLI commands that use GT translation services. For example, using `en-us` with the API requires `customMapping: { "en-us": { "code": "en-US" } }`; otherwise the command exits with guidance before running the translation workflow. Local-only commands and dry runs retain their existing validation. Restore configured identities in service metadata; without a corresponding requested identity, use the first matching configured locale.

  Align server/browser locale values and expose the configured locale list through `useLocales()`. In Next.js, preserve configured identities in localized paths, route overrides, and locale availability. Resolve unsupported locale preferences before deciding whether to prefix the default locale, and cache locale resolution during middleware initialization.

  For Next.js App Router, read locale and region from server-provided conditions. Setters write request cookies and retain pending values for the refresh callback; hooks keep reading the current server conditions until a new snapshot arrives, including when a locale switch is rejected. Use `router.refresh()` on Next.js 16.1 and newer and a document reload on older versions to avoid stale layout/provider snapshots after middleware redirects. Detect this capability at build time, retain the existing document reload when returning to the default locale, and leave other React integrations' cookie-backed behavior unchanged. This adds no request-time cookie reads and does not change App Router's existing `enableI18n` behavior.

## 0.1.8

### Patch Changes

- [#2068](https://github.com/generaltranslation/gt/pull/2068) [`f2204b9`](https://github.com/generaltranslation/gt/commit/f2204b990278865c54d14d337392930ea1ec31bf) Thanks [@eoinest](https://github.com/eoinest)! - Represent React's persisted boolean and null rich-content values in the shared
  JSX wire types used by framework runtimes and translation catalogs.

## 0.1.5-iris.0

### Patch Changes

- f2204b9: Represent React's persisted boolean and null rich-content values in the shared
  JSX wire types used by framework runtimes and translation catalogs.
- 5d8b78a: Migrate the package license from FSL-1.1-ALv2 to MIT.
- Updated dependencies [5d8b78a]
  - @generaltranslation/icu@0.1.2-iris.0

## 0.1.7

### Patch Changes

- [#2109](https://github.com/generaltranslation/gt/pull/2109) [`bb08d8c`](https://github.com/generaltranslation/gt/commit/bb08d8cc5df87c71dd2a31416087821dbae38aa8) Thanks [@eoinest](https://github.com/eoinest)! - Reuse the prepared configured-locale scope when deciding whether a locale requires translation.

## 0.1.6

### Patch Changes

- [#2108](https://github.com/generaltranslation/gt/pull/2108) [`d0ae632`](https://github.com/generaltranslation/gt/commit/d0ae632ac0cd53600f6b893c23754dde06fbe808) Thanks [@eoinest](https://github.com/eoinest)! - Prepare and reuse an indexed configured-locale scope when determining the best supported locale.

## 0.1.5

### Patch Changes

- [#2074](https://github.com/generaltranslation/gt/pull/2074) [`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8) Thanks [@eoinest](https://github.com/eoinest)! - Migrate the package license from FSL-1.1-ALv2 to MIT.

- Updated dependencies [[`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8)]:
  - @generaltranslation/icu@0.1.2

## 0.1.4

### Patch Changes

- Updated dependencies [[`e55aaa9`](https://github.com/generaltranslation/gt/commit/e55aaa9cfdf6dfe3ab96d0eea927f255b66cd20d)]:
  - @generaltranslation/icu@0.1.1

## 0.1.3

### Patch Changes

- [#1929](https://github.com/generaltranslation/gt/pull/1929) [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Replace the FormatJS ICU parser and runtime formatter dependencies with the new dependency-free `@generaltranslation/icu` package.

- Updated dependencies [[`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - @generaltranslation/icu@0.1.0

## 0.1.2

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`88f3a2e`](https://github.com/generaltranslation/gt/commit/88f3a2e0f304fdd19891afac0b41954edc9497c6) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an Odysseus patch release for format utilities.

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`5752fe8`](https://github.com/generaltranslation/gt/commit/5752fe81bf5b5deaae878638e0de99959bf719be) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

## 0.1.2-odysseus.1

### Patch Changes

- [#1678](https://github.com/generaltranslation/gt/pull/1678) [`4b97bc3`](https://github.com/generaltranslation/gt/commit/4b97bc360b2869bbb6e5f214589ef84f6d58a660) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Organize package entrypoint exports and replace re-export-only imports with direct export declarations.

## 0.1.2-odysseus.0

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

- [#1628](https://github.com/generaltranslation/gt/pull/1628) [`620621a`](https://github.com/generaltranslation/gt/commit/620621aceeafedbb958884cacc5495736191b065) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an Odysseus patch release for format utilities.

## 0.1.1

### Patch Changes

- [#1416](https://github.com/generaltranslation/gt/pull/1416) [`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa) Thanks [@bgub](https://github.com/bgub)! - Honor custom locale region display-name overrides and simplify shared locale formatting helpers.

## 0.1.0

### Minor Changes

- [#1397](https://github.com/generaltranslation/gt/pull/1397) [`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99) Thanks [@bgub](https://github.com/bgub)! - Extract locale and formatting primitives into the new `@generaltranslation/format` package and update `generaltranslation/core` to re-export the shared helpers.

## 0.0.1

### Minor Changes

- Initial locale and formatting primitives package.
