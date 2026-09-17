---
'generaltranslation': patch
---

Restore configured locale aliases in `uploadTranslations()` responses in the GT client and shared API adapter. For example, a returned `en-GB` locale now becomes `en-gb` when that alias is configured.
