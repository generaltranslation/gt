---
'@generaltranslation/icu': minor
---

`checkIcuTranslation(sourceIcu, translationIcu, { locale })` checks a translated ICU string from any library against its source, by the same rules as `checkTranslation`, which checks a message tree.

- It reads any ICU the parser reads. A style name or a skeleton is kept as written, and a skeleton is compared by its tokens, so spacing is no change. A pattern, like `{d, date, MM/dd/yyyy}`, or an app's own style name, is the translator's to localize, so where the source uses one, that placeholder's styles are not compared.
- A source that is not valid ICU throws the parser's `SyntaxError`. A translation that is not valid ICU is a problem with it: its parser message is returned.

`checkTranslation` now checks branch keys too:

- Every exact `=N` branch the source has for a plural must be in the translation, as in `"n" is missing the exact branch =0, which the source has`. Adding one is still allowed.
- A select's keys must be the source's, compared across all uses of the variable: `"g" is missing the select branch female` and `"g" has the select branch femenino, which the source does not`.
- A plural branch that is no CLDR category, like `lots`, is reported without a `locale` too.
- Keys only inside a plural category branch the locale does not have, and so may be left out, are not required.
