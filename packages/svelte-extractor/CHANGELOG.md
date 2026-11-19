# @generaltranslation/svelte-extractor

## 0.1.0-samsara.11

### Minor Changes

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

### Patch Changes

- Updated dependencies [2c3f4f6]
- Updated dependencies [2c3f4f6]
- Updated dependencies [cdee423]
- Updated dependencies [c30676f]
- Updated dependencies [7b5075a]
- Updated dependencies [2eec421]
- Updated dependencies [48db495]
- Updated dependencies [48db495]
- Updated dependencies [984147d]
- Updated dependencies [63851ee]
- Updated dependencies [550e8ca]
- Updated dependencies [5cb51b4]
- Updated dependencies [c0f8d3d]
- Updated dependencies [b078069]
  - generaltranslation@10.0.0-samsara.10
  - @generaltranslation/format@1.0.0-samsara.10
  - @generaltranslation/icu@1.0.0-samsara.8

## 0.1.0-samsara.10

### Patch Changes

- 943c094: Import types and helpers from their single owning entry now that the types-only subpaths are removed. No public API change.
- Updated dependencies [96f428a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [63b6748]
- Updated dependencies [ea429a2]
- Updated dependencies [82999f0]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [943c094]
- Updated dependencies [ba09ee2]
- Updated dependencies [82999f0]
- Updated dependencies [96f428a]
- Updated dependencies [3832c15]
- Updated dependencies [943c094]
- Updated dependencies [06ccdfd]
- Updated dependencies [a191c9a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [1a5e9ae]
- Updated dependencies [e29f6f9]
  - generaltranslation@10.0.0-samsara.9
  - @generaltranslation/format@1.0.0-samsara.9
  - @generaltranslation/icu@0.2.0-samsara.7

## 0.1.0-samsara.9

### Patch Changes

- Updated dependencies [fe7b0cc]
- Updated dependencies [2a5fe85]
- Updated dependencies [2a5fe85]
  - @generaltranslation/icu@0.2.0-samsara.6
  - generaltranslation@10.0.0-samsara.8
  - @generaltranslation/format@1.0.0-samsara.8

## 0.1.0-samsara.8

### Patch Changes

- Updated dependencies [b1b9d26]
- Updated dependencies [27c26cd]
- Updated dependencies [27c26cd]
  - @generaltranslation/icu@0.2.0-samsara.5
  - @generaltranslation/format@1.0.0-samsara.7
  - generaltranslation@10.0.0-samsara.7

## 0.1.0-samsara.7

### Patch Changes

- Updated dependencies [6440bd1]
- Updated dependencies [930e443]
- Updated dependencies [8dde4bb]
- Updated dependencies [84d0104]
- Updated dependencies [ada6894]
  - @generaltranslation/format@1.0.0-samsara.6
  - generaltranslation@10.0.0-samsara.6
  - @generaltranslation/icu@0.2.0-samsara.4

## 0.1.0-samsara.6

### Patch Changes

- Updated dependencies [886232a]
  - generaltranslation@10.0.0-samsara.5
  - @generaltranslation/format@1.0.0-samsara.5

## 0.1.0-samsara.5

### Patch Changes

- Updated dependencies [7ef8d91]
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
  - @generaltranslation/format@1.0.0-samsara.4
  - generaltranslation@10.0.0-samsara.4

## 0.1.0-samsara.4

### Patch Changes

- Updated dependencies [cf23e00]
  - generaltranslation@10.0.0-samsara.3

## 0.1.0-samsara.3

### Patch Changes

- Updated dependencies [b2aaf5e]
  - @generaltranslation/icu@0.2.0-samsara.2
  - generaltranslation@10.0.0-samsara.2
  - @generaltranslation/format@1.0.0-samsara.3

## 0.1.0-samsara.2

### Patch Changes

- Updated dependencies [22b6915]
- Updated dependencies [f3ed76d]
- Updated dependencies [4b6ea22]
- Updated dependencies [cc73381]
- Updated dependencies [726168a]
- Updated dependencies [040ea63]
  - generaltranslation@10.0.0-samsara.1
  - @generaltranslation/format@1.0.0-samsara.2
  - @generaltranslation/icu@0.2.0-samsara.1

## 0.1.0-samsara.1

### Patch Changes

- 12666a6: fix: render and extract whitespace inside `<T>` the way the Svelte compiler renders it, instead of removing whitespace that contains a line break as JSX does. Content wrapped across lines now keeps its spaces. Extracted text also matches what the browser parses (carriage returns become line feeds, and a line feed that opens a `<pre>` is dropped), whitespace between SVG elements is dropped as Svelte drops it, and the source renders the same with the `preserveWhitespace` compiler option. `<style>` and `<script>` inside `<T>` are now extraction errors, because their contents are code, not translatable text. The source and hash of affected entries change, and the extractor no longer exports `normalizeJsxText`.

## 0.1.0-samsara.0

### Minor Changes

- 8673283: feat: add gt-svelte, a Svelte 5 SDK whose `<T>` is prepared at build time by a preprocessor

### Patch Changes

- Updated dependencies [da7af80]
- Updated dependencies [bb107a8]
- Updated dependencies [002f579]
  - generaltranslation@10.0.0-samsara.0
  - @generaltranslation/format@1.0.0-samsara.1
