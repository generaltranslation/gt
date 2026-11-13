---
'@generaltranslation/icu': minor
---

`checkTranslation` and `checkIcuTranslation` now check where a variable is shown:

- A reader who sees a variable in the source must see it in the translation. A variable may still repeat, and move into every branch of a select or plural or out of them; moved into one branch only, it is a problem, as in `"n" is not shown when g is other, as it is in the source` and `"folder" is not shown in every branch, as it is in the source`. With a locale, a plural branch the locale never picks is left out.
- A variable that is inside a tag at every use in the source must stay inside that tag, as in `"name" is not inside <b>, as it is in the source`. Moving a variable into a tag, splitting a tag and nesting tags another way are still allowed.

**Breaking:** a translation that moved a variable into one branch, or out of its tag, was accepted and is now a problem.

A style name or skeleton used where the source has one pattern now says what may stand in for it: `"d" uses {d, date, long}, where the source has {d, date, MM/dd/yyyy}: keep it or localize its pattern`.
