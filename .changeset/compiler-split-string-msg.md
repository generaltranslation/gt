---
'@generaltranslation/compiler': patch
---

A build with `experimentalSplitTranslations` now keeps the translation of a `msg('text')` call in the unsplit file, as it does for a `msg` template. `m()` reads such a message by its hash from any page, and it rendered its source text where a `t` template in another chunk had the same text, because the build had put the translation in that chunk's file alone.
