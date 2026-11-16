---
'@generaltranslation/format': patch
---

`GTIntl#requiresTranslation` decides once per configured locale. A `<T>` or variable render asks this once or twice, and each answer canonicalized both locales, at 1.5 to 2.3 µs; an answer for the default locale or one of `locales` now takes a few nanoseconds after the first. A locale that is not configured is still decided on every call, and results are unchanged.
