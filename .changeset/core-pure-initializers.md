---
'generaltranslation': patch
---

Mark logger and model-provider initializers as pure so downstream bundlers can remove them when unused, keeping constant-only imports such as `libraryDefaultLocale` small.
