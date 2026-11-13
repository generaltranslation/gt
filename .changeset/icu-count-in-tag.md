---
'@generaltranslation/icu': patch
---

`checkTranslation` and `checkIcuTranslation` hold a plural's count to its tag. Where every `#` of a plural is inside a tag in the source, a `#` the translation writes must be inside that tag too, as in `"n" is not inside <b>, as it is in the source`. A tag may still move from around a plural into each of its branches, and a branch may leave `#` out.
