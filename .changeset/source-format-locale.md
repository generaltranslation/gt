---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
'gt-next': patch
'gt-tanstack-start': patch
'gt-svelte': patch
'gt-vue': patch
'@generaltranslation/format': patch
---

Source content now formats in the render locale when that locale is in the default locale's language. With `defaultLocale: 'es'`, a user in `es-MX` sees `1,234.5` instead of `1234,5`, and with `defaultLocale: 'en'`, a user in `en-GB` sees `31 Dec 2025` instead of `Dec 31, 2025`.

This applies to messages without a translation and to locales that need none, in `` t`…` ``, `m()`, `tx`, `<T>`, and the standalone `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>` and `<Plural>`. In gt-svelte it also applies to the string function from `useGT()`. Source content shown in another language, such as an untranslated message in `fr`, still formats in the default locale.

`<Plural>` in gt-react and gt-svelte selects by the code of a `customMapping` alias. An alias that `Intl` cannot read, like `portal_fr` for `fr`, threw a `RangeError`.
