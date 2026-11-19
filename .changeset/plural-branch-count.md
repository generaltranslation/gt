---
'@generaltranslation/format': patch
'@generaltranslation/react-core': patch
'gt-vue': patch
'gt-svelte': patch
---

A translation can make a `<Plural>` or `<Branch>` branch from the source's `other` branch instead of its own, and lists such branches in `d.o`. English `one` only covers 1, so `one="One file"` has no count, but Russian uses `one` for 21 and 31 too and its translation needs it. A listed branch renders with the elements and variables of the source's `other` branch; before, the count rendered as nothing.
