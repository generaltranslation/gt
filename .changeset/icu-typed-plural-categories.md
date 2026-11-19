---
'@generaltranslation/icu': patch
---

`getPluralCategories()` returns `Intl.LDMLPluralRule[]` instead of `string[]`, so a caller that names a category gets it checked. The categories and their order are the same.
