---
'gt': patch
---

Use the locale exactly as configured when substituting `{locale}` in file and JSON transforms, instead of canonicalizing it. Projects that configure a non-canonical tag such as `fr-ca` or `ja-jp` were getting content written to `docs/fr-CA/` while `[locale]` substitution and localized URLs used `docs/fr-ca/`, so every internal link in the translated output pointed at a directory that did not exist. Locales that are already canonical are unaffected.
