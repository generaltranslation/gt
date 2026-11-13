---
'@generaltranslation/format': patch
---

fix(format): stop revalidating configured locales on every `requiresTranslation` and `determineLocale` call when `customMapping` uses object entries with a `code`, which slowed server renders that look up many messages
