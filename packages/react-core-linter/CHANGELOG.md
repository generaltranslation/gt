# @generaltranslation/react-core-linter

## 0.2.0-samsara.3

### Patch Changes

- Updated dependencies [b2aaf5e]
  - @generaltranslation/icu@0.2.0-samsara.2
  - generaltranslation@10.0.0-samsara.2

## 0.2.0-samsara.2

### Minor Changes

- 899526b: Add the `unstable-static-branch` rule, enabled in the recommended config. It reports a `plural`, `selectordinal`, or `select` branch from an `/unstable` entry that is not static text or `part`...``: a plain template literal with values renders them as text, so the message never matches a translation, and a branch read from a variable cannot be extracted. Its editor suggestion wraps the template in `part` and adds the import.

### Patch Changes

- 726168a: Move the ICU string parser to `@generaltranslation/icu/parser`. The root entry no longer exports `parse`, `formatMessage`, `printAST`, the syntax-tree types, `TYPE`, or `SKELETON_TYPE`; import them from `@generaltranslation/icu/parser` instead. `formatMessage` now parses to a message tree and formats it exactly like `formatMessageTree`, with the same types. This changes how plain values render in ICU strings, including through `formatMessage` in `@generaltranslation/format` and `generaltranslation` and the string API built on them: they format like a template literal, so `true` is `'true'`, `false` is `'false'`, and bigints and Dates in a plain `{value}` are text (`null` and `undefined` stay empty). Previously intl-messageformat's rules kept `true`, bigints and Dates as parts, which the string API joined with commas, as in `'before ,true, after'`.

  The root entry now ships without the parser and works with message trees, a compact JSON form of a message where text is a string, `#` is `0`, and each placeholder is a tuple such as `['count', 'plural', { one: [0, ' file'], other: [0, ' files'] }]`. It adds `formatMessageTree` for formatting them (plain values, Dates included, format as text, like a template literal, so the result is typed `string` unless a value is rich, such as a React element or a tag formatter's result), and `validateMessageTree` and `isMessageTree` for checking untrusted trees against the `MessageTree` type. The new `@generaltranslation/icu/internal` entry, shared by General Translation packages and not a public API, holds `buildMessageTree` for building canonical trees from template parts (template text is always literal, including `#`; a `pound` hole is the plural count) and `findConflictingFormat` for finding a variable with two formats ICU spells the same way, which a translation cannot tell apart. The new `@generaltranslation/icu/convert` entry converts ICU strings to message trees with `icuToMessageTree` and prints trees as ICU with `messageTreeToIcu`; printing writes Intl options as an ICU skeleton such as `::currency/USD` (or the named `percent` style) that `icuToMessageTree` reads back as the same format, so every ICU string it reads prints back, leaves out tree-only options with no ICU spelling (such as `timeZone`), and `icuToMessageTree(icu, { source })` restores those from the tree the string was printed from.

- Updated dependencies [22b6915]
- Updated dependencies [f3ed76d]
- Updated dependencies [4b6ea22]
- Updated dependencies [cc73381]
- Updated dependencies [726168a]
- Updated dependencies [040ea63]
  - generaltranslation@10.0.0-samsara.1
  - @generaltranslation/icu@0.2.0-samsara.1

## 0.2.0-samsara.1

### Minor Changes

- 30c5018: Add the `translation-function-placement` rule, on in the recommended config. It reports `getGT()`, `getMessages()`, `getTranslations()`, `getLocale()` and `getEnableI18n()` from `gt-tanstack-start` called at module scope, where a server reuses the first request's locale for every later request, or in a component or hook, which should use `useGT()` and the other hooks instead. The other rules now also check imports from `gt-tanstack-start`.

## 0.1.16-samsara.0

### Patch Changes

- Updated dependencies [0604209]
  - @generaltranslation/icu@0.1.3-samsara.0

## 0.1.15-iris.0

### Patch Changes

- 5d8b78a: Migrate the package license from FSL-1.1-ALv2 to MIT.
- Updated dependencies [5d8b78a]
  - @generaltranslation/icu@0.1.2-iris.0

## 0.1.15

### Patch Changes

- [#2074](https://github.com/generaltranslation/gt/pull/2074) [`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8) Thanks [@eoinest](https://github.com/eoinest)! - Migrate the package license from FSL-1.1-ALv2 to MIT.

- Updated dependencies [[`240a65e`](https://github.com/generaltranslation/gt/commit/240a65e9305a74cdfd4df07537fb4cfae8a2eac8)]:
  - @generaltranslation/icu@0.1.2

## 0.1.14

### Patch Changes

- Updated dependencies [[`e55aaa9`](https://github.com/generaltranslation/gt/commit/e55aaa9cfdf6dfe3ab96d0eea927f255b66cd20d)]:
  - @generaltranslation/icu@0.1.1

## 0.1.13

### Patch Changes

- [#1929](https://github.com/generaltranslation/gt/pull/1929) [`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Replace the FormatJS ICU parser and runtime formatter dependencies with the new dependency-free `@generaltranslation/icu` package.

- Updated dependencies [[`f53bb5e`](https://github.com/generaltranslation/gt/commit/f53bb5ea4b4989a2a4ad3aebf464011f01e029ad)]:
  - @generaltranslation/icu@0.1.0

## 0.1.12

### Patch Changes

- [#1873](https://github.com/generaltranslation/gt/pull/1873) [`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger package publication after repairing release workspace dependency resolution.

## 0.1.11

### Patch Changes

- [#1866](https://github.com/generaltranslation/gt/pull/1866) [`53e61ab`](https://github.com/generaltranslation/gt/commit/53e61abbb4522631f252bcd268eae9c079dd9967) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Recover the stable releases skipped after the Odysseus version regression and publish the accumulated package changes under new npm versions.

## 0.1.10

### Patch Changes

- [#1439](https://github.com/generaltranslation/gt/pull/1439) [`d48604e`](https://github.com/generaltranslation/gt/commit/d48604e2171aa84c76873cacb6eb8d43c2f17546) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

## 0.1.10-odysseus.0

### Patch Changes

- [#1508](https://github.com/generaltranslation/gt/pull/1508) [`cc1499d`](https://github.com/generaltranslation/gt/commit/cc1499d12789ffd7ee3c6ca20d2eec734a1c9575) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - Trigger an odysseus prerelease patch for all publishable packages.

## 0.1.10

### Patch Changes

- [#1786](https://github.com/generaltranslation/gt/pull/1786) [`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `requiresReview`

## 0.1.9

### Patch Changes

- [#1226](https://github.com/generaltranslation/gt/pull/1226) [`19a0175`](https://github.com/generaltranslation/gt/commit/19a0175101c9478876fd014c749108709559bae0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: some quality of life improvements for string linting (auto fix, edge case handling)

## 0.1.8

### Patch Changes

- [#1223](https://github.com/generaltranslation/gt/pull/1223) [`7459ab0`](https://github.com/generaltranslation/gt/commit/7459ab0a1038bac3557865cf2fa640422a2c26ad) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add branch insertion

## 0.1.7

### Patch Changes

- [#1190](https://github.com/generaltranslation/gt/pull/1190) [`828bd73`](https://github.com/generaltranslation/gt/commit/828bd73235e9f3aea234e53b9ca258b7829b1008) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: auto var wrapping

## 0.1.6

### Patch Changes

- [#1161](https://github.com/generaltranslation/gt/pull/1161) [`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update logo blocks in READMEs

## 0.1.5

### Patch Changes

- [#1125](https://github.com/generaltranslation/gt/pull/1125) [`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8) Thanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo URLs in README files (updated to `/brand/gt-logo-*.svg`)

## 0.1.4

### Patch Changes

- [#1062](https://github.com/generaltranslation/gt/pull/1062) [`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor: rename static to derive, and deprecate static

## 0.1.3

### Patch Changes

- [#1069](https://github.com/generaltranslation/gt/pull/1069) [`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new gt package

## 0.1.2

### Patch Changes

- [#1068](https://github.com/generaltranslation/gt/pull/1068) [`94b95ef`](https://github.com/generaltranslation/gt/commit/94b95ef662b81dac51416ecc64f3318339171f0b) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: runtime calculation for the injection of 'data-' attribute in jsx

## 0.1.1

### Patch Changes

- [#1051](https://github.com/generaltranslation/gt/pull/1051) [`d36d4b8`](https://github.com/generaltranslation/gt/commit/d36d4b8459626c552c143fbdfa6d01f647a66533) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: string list registration

## 0.1.0

### Minor Changes

- [#923](https://github.com/generaltranslation/gt/pull/923) [`24d8b8a`](https://github.com/generaltranslation/gt/commit/24d8b8af9174e31b5fd4a0755c8ad83194f67947) Thanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: basic Jsx and string validation
