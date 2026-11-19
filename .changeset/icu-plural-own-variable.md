---
'@generaltranslation/icu': minor
---

`checkTranslation` and `checkIcuTranslation` hold a plural's count to one rule, whether the source writes it as `#` or as the plural's own variable by name, `{count}` or `{count, number}`. A branch only one number takes, a category like German `one` or an exact `=N` branch, may say that number in words, as ICU's own `=1` examples do:

```text
source       {count, plural, one {{count} file} other {{count} files}}
translation  {count, plural, one {Eine Datei} other {{count} Dateien}}   (de)
before       "count" is not shown in every branch, as it is in the source
after        accepted, as it already was where the source writes #
```

Where the variable is missing from a branch that takes several numbers, the problem names that branch, as in `"count" is not shown in the plural branch one, which ru uses for 1, 21, 31, 41, …, as it is in the source`, instead of also reporting `"count" is not shown in every branch`. Every other variable, like a name or a date, is still required wherever the source shows it.
