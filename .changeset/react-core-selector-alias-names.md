---
'@generaltranslation/react-core': patch
---

The locale and region selectors name locales and regions when the active locale is a `customMapping` alias, such as `portal_fr: { code: 'fr' }`. They showed codes instead of names, sorted locales by code, and lost the active locale's region. Choosing a region as a locale selector (`asLocaleSelector`) no longer switches from the alias to its code, such as from `portal_de` to `de`: a region gives the locale under its configured name, and the active locale for its own region. A region that several configured locales share gives the first of them.
