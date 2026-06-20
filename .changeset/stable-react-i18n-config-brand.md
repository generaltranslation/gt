---
'@generaltranslation/react-core': patch
---

Use a stable React i18n config brand instead of `instanceof` so config singletons initialized through one bundled entry point can be read from another.
