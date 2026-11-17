---
'@generaltranslation/icu': patch
---

`formatMessageTree` and `formatIcu` no longer look their locale up on every call: a call in the same locale as the one before it reuses that result. Formatting a catalog that is mostly plain text is about 20% faster.
