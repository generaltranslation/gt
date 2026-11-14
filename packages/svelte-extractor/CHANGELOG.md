# @generaltranslation/svelte-extractor

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
