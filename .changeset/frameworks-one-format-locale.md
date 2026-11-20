---
'@generaltranslation/react-core': major
'gt-vue': minor
'gt-svelte': minor
---

`<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>`, `<Plural>` and translated `<T>` content give `Intl` the locale they render in, then the default locale. `Intl` formats in the first of the two it has data for, and in the browser's or the host's locale when it has data for neither.
