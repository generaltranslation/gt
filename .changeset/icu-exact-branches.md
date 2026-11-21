---
'@generaltranslation/icu': minor
---

`@generaltranslation/icu/convert` exports the rule for a plural branch that says its number in words. A category is not a number: English `one` is only 1, so `one {One file}` is right in English, but Russian `one` is also 21 and Japanese has no `one`, so translated there the text belongs to the exact branch `=1`.

- `getExactBranchCount(category, sourceLocale, targetLocale)` gives the number a cardinal category stands for in the source locale, where the target locale does not pick that category for that number alone: `1` for `one` from English into Russian, French or Japanese, and `undefined` into German, whose `one` is only 1 too. It answers `undefined` when `Intl` has no plural rules for either locale.
- `moveToExactBranches(tree, sourceLocale, targetLocale)` rewrites a source message tree the way it is translated: `{n, plural, one {One file} other {# files}}` becomes `{n, plural, =1 {One file} other {# files}}` from English into Russian. A branch that shows the count, like `one {# file}`, stays, as does one whose number has an exact branch already, and an ordinal. A plural with an offset moves to the number its category is picked for.

Check a translation against the rewritten source and `checkTranslation` asks it to keep `=1`. Both are on the `convert` entry, so the main entry that formats messages at runtime is unchanged.
