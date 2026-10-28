---
'@generaltranslation/react-core': patch
---

Move the dictionary half of `I18nStore` into a `CompatStore`, and dictionary state out of `InternalGTProvider` and its context into a separate `DictionaryProvider` with its own context. `useTranslations()`, its tracked dictionary resolvers and the dictionary dev hot-reload queue now live in compat modules. `InternalGTProvider` no longer accepts `dictionaries` or `onMissingDictionary*`, and `internalInitializeGTSRA()` no longer accepts `dictionary` or `loadDictionary`. Native modules no longer import dictionary code; the bundle win lands when `GTProvider` stops accepting dictionaries.
