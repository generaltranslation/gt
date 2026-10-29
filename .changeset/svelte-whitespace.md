---
'gt-svelte': patch
'@generaltranslation/svelte-extractor': patch
---

fix: render and extract whitespace inside `<T>` the way the Svelte compiler renders it, instead of removing whitespace that contains a line break as JSX does. Content wrapped across lines now keeps its spaces. Extracted text also matches what the browser parses (carriage returns become line feeds, and a line feed that opens a `<pre>` is dropped), whitespace between SVG elements is dropped as Svelte drops it, and the source renders the same with the `preserveWhitespace` compiler option. `<style>` inside `<T>` is now an extraction error, because its contents are CSS, not translatable text. The source and hash of affected entries change, and the extractor no longer exports `normalizeJsxText`.
