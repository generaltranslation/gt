---
'generaltranslation': major
---

`uploadTranslations` takes each source as a `TranslationSourceUpload`, which has no `locale`, and no longer sends one: the API looks the source file up and keeps the locale it was uploaded with. Remove `locale` from the `source` you pass. It also sends and uploads only the fields the request takes, so a source or translation passed with other fields, such as `formatMetadata`, no longer has them sent or uploaded.
