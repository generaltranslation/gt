---
'gt-i18n': patch
---

fix(i18n): serve configured locales that are the same dialect as the default locale (for example `en` when the default is `en-US`, or an alias whose `code` matches the default) as source content again, instead of loading translations and dictionaries that GT never produces for them
