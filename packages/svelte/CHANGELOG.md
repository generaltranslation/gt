# gt-svelte

## 0.1.0-samsara.12

### Patch Changes

- Updated dependencies [622199e]
- Updated dependencies [fcc6f14]
- Updated dependencies [3bedb87]
- Updated dependencies [7d841de]
- Updated dependencies [c8e2b0b]
- Updated dependencies [e70da5f]
  - @generaltranslation/format@1.0.0-samsara.11
  - gt-i18n@2.0.0-samsara.11
  - generaltranslation@10.0.0-samsara.11
  - @generaltranslation/svelte-extractor@0.1.0-samsara.12

## 0.1.0-samsara.11

### Minor Changes

- cdee423: `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>`, `<Plural>` and translated `<T>` content format in the locale they render in, alone. The default locale is no longer tried behind it when `Intl` has no data for that locale, which then formats in the browser's or the host's locale.

  The `locales` prop reaches `Intl` as it is given: the active locale and the default locale are no longer added after it. To keep a fallback, list it: `<Num locales={[locale, defaultLocale]}>`.

- 5cb51b4: **Breaking:** `<Plural>` and `<Branch>` now choose a branch the way `plural()` and `select()` do, in React, Vue and Svelte.
  - **ICU plural selection.** `<Plural>` picks an exact branch first, then the locale's plural category for `n`, then its children. `zero`, `one` and `two` are plural categories, no longer the numbers 0, 1 and 2: in English `zero` never matches, and in Japanese neither does `one`. For an exact number write `_0`, `_1` and so on, the JSX spelling of ICU's `=0`: `<Plural n={count} _0="No items" one="1 item">Many items</Plural>`. Stored content and translations use the ICU key, `=0`.
  - **No aliases.** The `singular`, `plural` and `dual` branches are removed: write `one`, the children and `two`. `PluralType` from `generaltranslation` no longer includes them.
  - **The children are the fallback, and `other` is not a prop.** The children of a `<Plural>` or a `<Branch>` are what `other` is in `plural()` and `select()`: the content for a value with no branch of its own. In Vue that is the default slot. `<Plural other="...">` no longer works, and `<Branch other="...">`, which used to match only the value `"other"`, no longer does: write the content as the children. `gt`, the compiler and the Vue and Svelte extractors report an `other` prop, slot or snippet as an error. Stored content and translations hold the children under the ICU key `other`, with the other branches. `gt` and the compiler also warn about a `<Plural>` prop that looks like an exact number but is not one, such as `_01` or `_1e3`.
  - **Stricter props.** `<Plural>` requires children, takes `n` as a `number` or a `bigint`, and no longer has a `locales` prop, so in Vue a `locales` attribute is a branch like any other. `<Branch>` requires children unless its branches cover every value of `branch`, as in `<Branch branch={isAdmin} true="Admin" false="Member" />`. `_locale` and `_enableI18n` are no longer in the prop types of `<Plural>` and `<Branch>`. `gt-react` exports the `BranchProps` type beside `PluralProps`.
  - **The translation picks the branch.** In a translated locale, the branch is chosen among the translation's branches, and the source branch of the same name fills in its variables and elements; when the source has no branch of that name, its children do. A source `_0` branch no longer renders untranslated in a locale whose translation has no `=0` branch. A translation with no branch for the value renders the source: that element in React and Vue, the whole `<T>` in Svelte.
  - **Errors.** In React, an `n` that is not a number or a bigint, and a value with no branch and no children, throw in development. In production they log an error; a non-numeric `n` renders the children, and a missing branch renders nothing. Children that are empty, such as `{null}`, are a fallback that renders nothing. A `bigint` too large to have a plural category throws a `RangeError` unless an exact branch matches it, as in `plural()`. In Svelte, a branch passed as `undefined` counts as absent, as in React.
  - **Synchronous `<Branch>` in gt-next.** In a Server Component, gt-next's `<Branch>` is now gt-react's component and no longer an async wrapper around it: choosing a branch never needed the request's locale.

  A `<T>` with a `<Plural>` or a `<Branch>` has new source content, so its hash changes and it is translated again: the children are stored as the `other` branch, and the elements and unnamed variables after them are numbered from the component, not from its children. `gt`, the compiler, the gt-next SWC plugin and the Vue and Svelte extractors all read the new props, so update them together with the runtime packages.

  The `static-jsx` lint rule's fix writes `{x && "Active"}` as `<Branch branch={!!x} true="Active">{null}</Branch>`, since a `false` value needs a fallback, and a `null` alternative of a ternary the same way. A string that JSX text would not read back as written, such as `"&amp;"` or `"a < b"`, is written in braces.

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

- 5e95a50: `initializeGT()` takes effect when it runs again. gt-i18n kept the first configuration and translation cache it was given, so after a Vite dev server restart the server kept calling the `loadTranslations` of the closed module runner, and every non-default locale failed with `Vite module runner has been closed` until the process restarted.

  A second `initializeGT()` in `gt-svelte`, `gt-react`, `gt-react-native` or `gt-node` now replaces the configuration and the translation cache, and cached translations load again through the new loader. Call it once per module, not once per request. `gt-next` initializes itself on import and keeps its first initialization, as before.

  gt-i18n no longer logs when a second instance is set, and no longer reads the `_GENERALTRANSLATION_LOG_LEVEL` environment variable, which only gated that log.

- Updated dependencies [2c3f4f6]
- Updated dependencies [2c3f4f6]
- Updated dependencies [cdee423]
- Updated dependencies [c30676f]
- Updated dependencies [5e95a50]
- Updated dependencies [cdee423]
- Updated dependencies [550e8ca]
- Updated dependencies [550e8ca]
- Updated dependencies [5cb51b4]
- Updated dependencies [c0f8d3d]
- Updated dependencies [b078069]
- Updated dependencies [7d49a34]
- Updated dependencies [99a2528]
- Updated dependencies [28a2e47]
  - generaltranslation@10.0.0-samsara.10
  - @generaltranslation/format@1.0.0-samsara.10
  - gt-i18n@2.0.0-samsara.10
  - @generaltranslation/svelte-extractor@0.1.0-samsara.11

## 0.1.0-samsara.10

### Minor Changes

- 63b6748: Each package ships `config-schema.json`, the JSON Schema of a `gt.config.json` for a project that uses it: the gt CLI's keys and the package's own, and no others. Point `$schema` at it, as `gt init` does: `"$schema": "./node_modules/gt-next/config-schema.json"`.

### Patch Changes

- 016ace7: Remove the `devApiKey` option. One `apiKey` now covers both uses: in development it enables hot reload translation, and in production it lets server code translate at runtime. Pass your key as `apiKey` wherever you passed `devApiKey`, for example `initializeGT({ apiKey })` in gt-node.

  gt-react ignores an `apiKey` that reaches production browser code and logs a warning, because anyone can read a key from a browser bundle. Translate at runtime on your server instead.

- 943c094: Import types and helpers from their single owning entry now that the types-only subpaths are removed. No public API change.
- Updated dependencies [96f428a]
- Updated dependencies [96f428a]
- Updated dependencies [cf7029c]
- Updated dependencies [2d7f9bd]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [63b6748]
- Updated dependencies [ea429a2]
- Updated dependencies [82999f0]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [943c094]
- Updated dependencies [016ace7]
- Updated dependencies [ba09ee2]
- Updated dependencies [82999f0]
- Updated dependencies [96f428a]
- Updated dependencies [3832c15]
- Updated dependencies [2d7f9bd]
- Updated dependencies [943c094]
- Updated dependencies [cf7029c]
- Updated dependencies [82999f0]
- Updated dependencies [63b6748]
- Updated dependencies [13dae8a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [943c094]
- Updated dependencies [a191c9a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [1a5e9ae]
- Updated dependencies [e29f6f9]
- Updated dependencies [943c094]
  - generaltranslation@10.0.0-samsara.9
  - gt-i18n@2.0.0-samsara.9
  - @generaltranslation/format@1.0.0-samsara.9
  - @generaltranslation/svelte-extractor@0.1.0-samsara.10

## 0.1.0-samsara.9

### Patch Changes

- generaltranslation@10.0.0-samsara.8
- @generaltranslation/format@1.0.0-samsara.8
- gt-i18n@2.0.0-samsara.8
- @generaltranslation/svelte-extractor@0.1.0-samsara.9

## 0.1.0-samsara.8

### Patch Changes

- Updated dependencies [27c26cd]
- Updated dependencies [27c26cd]
  - gt-i18n@2.0.0-samsara.7
  - @generaltranslation/format@1.0.0-samsara.7
  - generaltranslation@10.0.0-samsara.7
  - @generaltranslation/svelte-extractor@0.1.0-samsara.8

## 0.1.0-samsara.7

### Patch Changes

- Updated dependencies [6440bd1]
- Updated dependencies [f88a4dc]
- Updated dependencies [8dde4bb]
- Updated dependencies [ada6894]
  - @generaltranslation/format@1.0.0-samsara.6
  - generaltranslation@10.0.0-samsara.6
  - gt-i18n@2.0.0-samsara.6
  - @generaltranslation/svelte-extractor@0.1.0-samsara.7

## 0.1.0-samsara.6

### Patch Changes

- Updated dependencies [886232a]
  - generaltranslation@10.0.0-samsara.5
  - @generaltranslation/format@1.0.0-samsara.5
  - gt-i18n@2.0.0-samsara.5
  - @generaltranslation/svelte-extractor@0.1.0-samsara.6

## 0.1.0-samsara.5

### Patch Changes

- Updated dependencies [7ef8d91]
- Updated dependencies [7ef8d91]
- Updated dependencies [3c013b5]
  - @generaltranslation/format@1.0.0-samsara.4
  - generaltranslation@10.0.0-samsara.4
  - gt-i18n@2.0.0-samsara.4
  - @generaltranslation/svelte-extractor@0.1.0-samsara.5

## 0.1.0-samsara.4

### Patch Changes

- Updated dependencies [cf23e00]
  - generaltranslation@10.0.0-samsara.3
  - gt-i18n@2.0.0-samsara.3
  - @generaltranslation/svelte-extractor@0.1.0-samsara.4

## 0.1.0-samsara.3

### Patch Changes

- generaltranslation@10.0.0-samsara.2
- @generaltranslation/format@1.0.0-samsara.3
- gt-i18n@2.0.0-samsara.2
- @generaltranslation/svelte-extractor@0.1.0-samsara.3

## 0.1.0-samsara.2

### Patch Changes

- cc73381: Add experimental `gt-i18n/unstable` and `gt-i18n/unstable/internal` entries. Their API may change in any minor release and is not covered by semver. `t` is a tagged template (`` t`Hello, ${{ name }}!` `` or `` t({ context })`Save` ``) that builds a message tree from the template, hashes it with `hashSource`, and formats loaded tree translations without the ICU string parser. Helpers `plural`, `selectordinal`, `select`, `number`, `date`, `part`, `derive`, and `n` are exported from `gt-i18n/unstable`; framework packages use `createGT` and `getGT` from `gt-i18n/unstable/internal`. Missing tree translations render the source message and, in dev hot reload, are sent for runtime translation like string and JSX messages. Template text is always literal, including ICU syntax such as `#`. A bare value (`` t`Hi ${name}` ``) is an anonymous variable and `${{ name }}` a named one; either renders like a template literal (`true` as `'true'`, `12n` as `'12'`, `null` and `undefined` as nothing), and a `Date` is a type error that points to `date()`; helpers take either form, as in `plural({ count }, ...)` or `plural(count, ...)`. Plural and select branches are strings, or `part` templates when they hold placeholders, and a plain template literal with values in a branch is a type error; `n` is the count of the nearest plural (`` part`${n} items` ``). `derive()` inlines static text chosen in code; its argument must be typed as a string literal or a union of them, so the CLI can read every variant from the type.

  `Content` from `@generaltranslation/format/types` and `generaltranslation/types` replaces the `Translation` type, which `gt-i18n/types` no longer exports. Loaded catalogs, translation loaders, and the translations passed to React Core providers, gt-react-native's `LocaleTranslations`, and gt-svelte's `loadTranslations()` and `<GTProvider>` can hold message trees alongside string and JSX entries. Translation lookups and runtime translation take message trees with `$format: 'ICU_TREE'`, like any other format.

- Updated dependencies [22b6915]
- Updated dependencies [f3ed76d]
- Updated dependencies [4b6ea22]
- Updated dependencies [5ccf4ef]
- Updated dependencies [cc73381]
- Updated dependencies [726168a]
- Updated dependencies [040ea63]
- Updated dependencies [e6ef0c0]
  - generaltranslation@10.0.0-samsara.1
  - @generaltranslation/format@1.0.0-samsara.2
  - gt-i18n@2.0.0-samsara.1
  - @generaltranslation/svelte-extractor@0.1.0-samsara.2

## 0.1.0-samsara.1

### Patch Changes

- 12666a6: fix: render and extract whitespace inside `<T>` the way the Svelte compiler renders it, instead of removing whitespace that contains a line break as JSX does. Content wrapped across lines now keeps its spaces. Extracted text also matches what the browser parses (carriage returns become line feeds, and a line feed that opens a `<pre>` is dropped), whitespace between SVG elements is dropped as Svelte drops it, and the source renders the same with the `preserveWhitespace` compiler option. `<style>` and `<script>` inside `<T>` are now extraction errors, because their contents are code, not translatable text. The source and hash of affected entries change, and the extractor no longer exports `normalizeJsxText`.
- Updated dependencies [12666a6]
  - @generaltranslation/svelte-extractor@0.1.0-samsara.1

## 0.1.0-samsara.0

### Minor Changes

- 8673283: feat: add gt-svelte, a Svelte 5 SDK whose `<T>` is prepared at build time by a preprocessor

### Patch Changes

- Updated dependencies [da7af80]
- Updated dependencies [bb107a8]
- Updated dependencies [85eab51]
- Updated dependencies [002f579]
- Updated dependencies [8673283]
  - generaltranslation@10.0.0-samsara.0
  - @generaltranslation/format@1.0.0-samsara.1
  - gt-i18n@2.0.0-samsara.0
  - @generaltranslation/svelte-extractor@0.1.0-samsara.0
