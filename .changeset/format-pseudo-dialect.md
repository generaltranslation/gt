---
'@generaltranslation/format': patch
---

`isSameDialect` no longer treats CLDR pseudo-locales (`en-XA`, `ar-XB`) as the same dialect as their base language, so `requiresTranslation` correctly loads translations for pseudo-locales instead of falling back to source text.
