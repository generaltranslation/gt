---
'generaltranslation': minor
'@generaltranslation/compiler': minor
'gt-next': minor
---

Add the experimental `inlineTranslations` compiler option (`experimentalCompilerOptions.inlineTranslations` in gt-next, with either the babel or the SWC compiler). In production builds it embeds translations for the configured locales at each `gt()`, `t()`, and `<T>` call site as an inline translations callback, and bundlers tree-shake the translations with unused call sites. `msg()` is never embedded: apps load its strings from the msg()-only file the CLI writes with `files.gt.msgOutput`.
