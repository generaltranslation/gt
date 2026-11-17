---
'@generaltranslation/react-core': major
'gt-vue': minor
'gt-svelte': minor
---

`<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>`, `<Plural>` and translated `<T>` content format in the locale they render in, alone. The default locale is no longer tried behind it when `Intl` has no data for that locale, which then formats in the browser's or the host's locale.

The `locales` prop reaches `Intl` as it is given: the active locale and the default locale are no longer added after it. To keep a fallback, list it: `<Num locales={[locale, defaultLocale]}>`.
