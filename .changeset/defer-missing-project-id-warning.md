---
'gt-i18n': patch
---

Defer the missing-projectId and missing-translation-loader warnings from I18nCache construction to the first translation loader invocation. Clients of server-rendered apps receive translations via updateTranslations() and never invoke the fallback loader, so they no longer log spurious warnings on initialization.
