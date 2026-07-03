---
'gt-astro': minor
'@generaltranslation/compiler': patch
'gt': patch
---

Add gt-astro, an Astro integration for General Translation: locale-detection middleware with AsyncLocalStorage request scoping, request-scoped server translation functions for .astro files and endpoints, React island support via serialized GTProvider props, automatic compiler plugin registration, and Astro i18n config derivation from gt.config.json. Registers gt-astro import sources in the compiler and the gt-astro library in the CLI.
