---
'@generaltranslation/icu': patch
---

Checking whether a string is a decimal number no longer takes quadratic time on a long run of digits. This affects string values formatted with a `scale` and the `scale` option of a number skeleton; the strings accepted are the same.
