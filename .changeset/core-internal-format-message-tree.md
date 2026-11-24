---
'generaltranslation': patch
---

`generaltranslation/internal` no longer exports `formatMessageTree()`. A `GTIntl` formats a tree, with or without a config: `new GTIntl().formatMessageTree(tree, { values, formats })`.
