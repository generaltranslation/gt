# gt-svelte

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
