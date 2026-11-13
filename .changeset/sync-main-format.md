---
'@generaltranslation/format': patch
---

From `main` (`@generaltranslation/format` 0.1.10): configured locales are no longer revalidated on every `requiresTranslation` and `determineLocale` call when `customMapping` uses object entries with a `code`, which slowed server renders that look up many messages (#2718).
