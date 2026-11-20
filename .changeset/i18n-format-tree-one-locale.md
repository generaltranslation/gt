---
'gt-i18n': major
---

A message tree formats in the locale of the translation, then the default locale, which `Intl` formats in when it has no data for the first.

A translation of text alone renders for any locale, since it reaches no formatter. A locale that `Intl` rejects, like `fr_FR`, used to render the source for it with a warning; it still does for a translation that formats a number, a date or a plural.
