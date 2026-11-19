---
'@generaltranslation/format': patch
'@generaltranslation/react-core': patch
'gt-vue': patch
'gt-svelte': patch
---

A translation can show the count of a `<Plural>` in any of its branches, as `#` does in ICU: a variable `{ "v": "#" }` renders the plural's `n`, formatted as a number. English `one` only covers 1, so `one="One file"` has no count, but Russian uses `one` for 21 and 31 too and its translation needs it. Before, a translated branch could only use the variables of the source branch of the same name.
