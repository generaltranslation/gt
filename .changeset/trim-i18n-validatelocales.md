---
"gt-i18n": patch
---

Remove the unused `validateLocales` config validator from `gt-i18n`.

`validateLocales` was defined but never called (config validation runs `validateLoadTranslations`, `validateTranslationApi`, and `validateDictionary`) and had no consumers anywhere. Dead code removed.
