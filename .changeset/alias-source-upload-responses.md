---
'generaltranslation': patch
---

Restore configured locale aliases in `uploadSourceFiles()` responses in the GT client and shared API adapter. For example, a returned `en-GB` locale now becomes `en-gb` when that alias is configured. Include the API's optional `locale` field in the public upload response type.
