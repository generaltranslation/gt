---
'@generaltranslation/format': patch
---

Fix `formatListToParts` choosing a different connector than `formatList` for string and number items. A Spanish list now reads "Fernando e Isabel" and "7 u 8" instead of "Fernando y Isabel" and "7 o 8", and a Hebrew list attaches "ו" to a Hebrew word without a hyphen.
