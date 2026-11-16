---
'generaltranslation': minor
'@generaltranslation/compiler': minor
'gt-next': minor
---

Embed translations at build time for the locales in gt.config.json's experimental `files.gt.inlineTranslations.locales`, with either the babel or the SWC compiler in gt-next. In production builds the compiler reads each locale's translations from `files.gt.output` and embeds them at each `gt()`, `t()`, and `<T>` call site as an inline translations callback, and bundlers tree-shake the translations with unused call sites. `msg()` is never embedded: apps load its strings from the msg()-only file the CLI writes with `files.gt.inlineTranslations.msgOutput`.
