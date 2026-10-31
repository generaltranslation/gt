---
'gt-sanity': patch
---

Add the opt-in `allowNonDefaultSourceLocales` option (off by default) to translate documents written in a locale other than `sourceLocale` from the Translate dialog on that document. Each translation group has one original; gt-sanity records it on the group's metadata (`gtSourceLanguage`) when it is not in `sourceLocale`, and translations of a group cannot be translated from. Translate All still only covers originals in `sourceLocale`. With the option off, gt-sanity behaves as before.
