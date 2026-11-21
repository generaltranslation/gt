---
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
'gt-next': patch
'gt-tanstack-start': patch
'gt-svelte': patch
---

`<Plural>` and `<Ordinal>` in gt-react and gt-svelte select by the code of a `customMapping` alias. An alias that `Intl` cannot read, like `portal_fr` for `fr`, threw a `RangeError`.
