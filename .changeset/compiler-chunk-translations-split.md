---
'@generaltranslation/compiler': minor
---

Add `by: 'module'` (or `GT_SPLIT_TRANSLATIONS_BY=module`) to the experimental `experimentalSplitTranslations` option. Translations are then split by the modules each entry and dynamic import can reach through static imports, not by chunk, so a page no longer downloads the translations of every module that the bundler packed into a chunk it loads. Messages that the same imports need share a file, and files are merged while one request less is worth more than the bytes a page then downloads without needing them: `requestCost` in the option sets what a request is worth in bytes, 8192 by default. No message is in two files. Such a build names each file by the hash of its own content (`naming: 'map'`, and it fails with `'token'`), and each locale's map lists the files every dynamic import needs, so no JavaScript grows with them and a page in the default locale downloads none of it. The build checks that every entry and import holds each message its modules can read, and fails if one would not.

The split gains the most when a module runs when it is first imported, which is Rolldown's `output.strictExecutionOrder: true`. In a build that runs every module of a chunk as the chunk loads, a page also gets what those modules could read then, and the build prints how many messages that adds.

`previous` in the option takes the path of the `gt-chunk-translations.json` that the build before wrote: messages then stay in the file they were in where that still fits, so a change to the app renames few translation files. The default split, by chunk, is unchanged.
