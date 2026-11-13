# @generaltranslation/format

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
