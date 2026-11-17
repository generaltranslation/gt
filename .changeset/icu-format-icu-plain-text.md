---
'@generaltranslation/icu': patch
---

`formatIcu` returns a message without ICU syntax as its text without parsing it. Formatting a catalog that is mostly plain text is about three times faster.
