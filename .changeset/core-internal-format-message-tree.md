---
'generaltranslation': patch
---

`formatMessageTree()` in `generaltranslation/internal` takes one options object, like `GTIntl.formatMessageTree()` and the other standalone formatters: `formatMessageTree(tree, { locales, values, formats })`. It took the locales and the values as separate arguments.
