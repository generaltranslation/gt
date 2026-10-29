---
'gt-svelte': patch
'@generaltranslation/svelte-extractor': patch
---

fix: render and extract whitespace inside `<T>` the way the Svelte compiler renders it, instead of removing whitespace that contains a line break as JSX does. Content wrapped across lines now keeps its spaces. The source and hash of affected entries change, and the extractor no longer exports `normalizeJsxText`.
