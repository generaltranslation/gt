---
'@generaltranslation/icu': patch
'@generaltranslation/format': patch
'generaltranslation': patch
---

The CLDR plural categories are listed once, in `@generaltranslation/icu`; `generaltranslation` derives `PluralType` from that list. `@generaltranslation/format/internal` no longer exports `getCachedPluralRules`; `generaltranslation` reads plural rules from icu's shared Intl cache.
