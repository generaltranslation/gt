---
'@generaltranslation/icu': minor
---

`@generaltranslation/icu/convert` exports the two plural rules its checks already apply, so a format that keeps plural branches another way, such as stored JSX, can use the same ones:

- `getPluralCategories(locale, type)` lists the categories a locale uses, `'cardinal'` or `'ordinal'`, in CLDR's order: `['one', 'few', 'many', 'other']` for Russian plurals and `['one', 'other']` for French ordinals. It answers `undefined` for a locale `Intl` has no plural rules for, where `Intl` would answer for the host's language.
- `isExactKey(key)` says whether a branch key is an exact number as the parser writes it: `=1`, and not `=01` or `=1.5`.

They are on the `convert` entry, with the checks, so the main entry that formats messages at runtime is unchanged. `checkTranslation` and `checkIcuTranslation` read a locale's categories through `getPluralCategories`; what they report is unchanged.
