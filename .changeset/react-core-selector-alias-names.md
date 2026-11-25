---
'@generaltranslation/react-core': patch
---

The locale and region selectors name locales and regions when the active locale is a `customMapping` alias, such as `portal_fr: { code: 'fr' }`. They showed codes instead of names, sorted locales by code, and lost the active locale's region.
