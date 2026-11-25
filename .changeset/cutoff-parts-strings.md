---
'@generaltranslation/format': patch
---

`CutoffFormat`'s `formatToParts` types its result as one to three strings. It leaves out an absent terminator or separator, so no part is `undefined`.
