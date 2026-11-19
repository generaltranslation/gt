---
'@generaltranslation/icu': minor
---

`checkTranslation` and `checkIcuTranslation` now check that a plural shows its count wherever the translation's locale needs it. A plural category is not a word for one or many: Russian `one` is also 21, 31 and 41, so `{n, plural, one {Один файл} …}` read "one file" for 21 files and was accepted. With a `locale`, a count the source shows in its `other` branch must be shown, as that plural's own `#` (or the variable, where it has no offset), in each category branch the locale picks for more than one number, as in `"n" is not shown in the plural branch one, which ru uses for 1, 21, 31, 41, …, as it is in the source`. A category picked for one number only, like German `one`, may still say that number in words, and exact `=N` branches are free. Where an enclosing plural's exact branch, like `=0`, hides the count in the source, it may stay hidden there in the translation.

`getPluralCategoryCounts(locale, type, category)` is exported from `@generaltranslation/icu/convert`, next to `getPluralCategories`: the first counts a locale picks a category for, and whether it picks it for more, as in `{ counts: [1, 21, 31, 41], more: true }` for Russian `one`. A prompt that describes plural categories can use the same answer as the check.

**Breaking:** a translation that spelled out the count in a category picked for more than one number was accepted and is now a problem.
