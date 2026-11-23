---
'@generaltranslation/format': patch
'gt-i18n': patch
---

`requiresTranslation` and `hashMessage` keep their answers instead of validating locales and hashing the same message on every call. Both caches are bounded, and `requiresTranslation` recomputes after `locales` changes and skips the cache when a custom mapping has entries or an explicit approved list is passed.
