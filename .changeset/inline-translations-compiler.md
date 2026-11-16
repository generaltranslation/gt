---
'generaltranslation': minor
'@generaltranslation/compiler': minor
'gt-next': minor
---

Add the experimental `inlineTranslations` compiler option (`experimentalCompilerOptions.inlineTranslations` in gt-next, with either the babel or the SWC compiler). In production builds it embeds translations for the configured locales at each `gt()`, `msg()`, and `<T>` call site as an inline translations callback. Those locales resolve without loading a translation file, and bundlers tree-shake the translations with unused call sites.
