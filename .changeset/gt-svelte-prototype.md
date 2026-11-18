---
'gt-svelte': minor
'gt': minor
'generaltranslation': patch
---

Add `gt-svelte`, a prototype Svelte 5 runtime whose Vite plugin compiles `gt()` and `<T>` at build time and writes a manifest of translatable entries. For gt-svelte projects, `gt translate` reads that manifest, sends only the entries a target locale has not translated, and merges the downloaded translations into the existing catalogs.
