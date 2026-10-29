# gt-svelte

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
