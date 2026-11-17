---
'gt-i18n': major
---

A message tree formats in the locale of the translation alone: the default locale is no longer tried behind it when `Intl` has no data for that locale.

A translation of text alone renders for any locale, since it reaches no formatter. A locale that `Intl` rejects, like `fr_FR`, used to render the source for it with a warning; it still does for a translation that formats a number, a date or a plural.
