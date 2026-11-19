---
'@generaltranslation/react-core': patch
'gt-vue': patch
---

A translated `<Plural>` branch can show a variable that its own source branch leaves out. English `one` only covers 1, so `one="One file"` has no count, but Russian uses `one` for 21 and 31 too and its translation needs it. Such a branch now reads its variables and elements from the source's `other` branch; before, the count rendered as nothing.
