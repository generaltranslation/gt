---
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
'gt-next': patch
'gt-tanstack-start': patch
'gt-svelte': patch
'@generaltranslation/format': minor
'generaltranslation': minor
---

`<Plural>` and `<Ordinal>` in gt-react and gt-svelte select by the code of a `customMapping` alias. An alias that `Intl` cannot read, like `portal_fr` for `fr`, threw a `RangeError`, and one it can read, like `pirate`, selected by the rules of the host's locale.

`GTIntl` gains `getPluralRules()`, the plural rules of its target locale, and the `GTIntl` of `generaltranslation` gains `getPluralForm(n, forms)`, which picks a branch by them. Both read a locale alias as its code, like the formatters.
