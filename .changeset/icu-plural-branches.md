---
'@generaltranslation/icu': minor
---

`checkTranslation` checks a translation's plural branches against its locale.

Given a `locale`, each `plural` and `selectordinal` needs a branch for every category the locale has. A value with no branch for its category falls back to `other` and reads wrong: a Russian translation with only `one` and `other` prints `2 файлов`, not `2 файла`. It was accepted; it is now reported as `"n" is missing the plural branches few, many, which ru needs`.

- A branch that is no CLDR category, like `lots`, is reported too.
- A category the locale does not have, like `one` in Japanese, may still be left out or kept: it is never chosen.
- Exact branches like `=0` are not part of this check.
- Without a `locale`, or with one `Intl` has no plural rules for, no branch is checked. `Intl` would otherwise answer for the host's language, which also applied to the categories a translation may leave out.
