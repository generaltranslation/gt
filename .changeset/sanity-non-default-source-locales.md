---
'gt-sanity': patch
---

Add the opt-in `allowNonDefaultSourceLocales` option to translate documents written in a locale other than `sourceLocale`. Each translation group has one original; gt-sanity records it on the group's metadata (`gtSourceLanguage`) when it is not in `sourceLocale`, and translations of a group cannot be translated from.
