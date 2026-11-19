---
'gt-react': patch
---

`gt-react/chunk-translations` reads the translation files of a build made with `@generaltranslation/compiler`'s experimental `experimentalChunkTranslationsMinifyHashes` option. Such a file holds each of its translations once and, for the list of each chunk that reads some of them, runs of a place in the list, the place of its translation in the file, and how many follow on from both. The entry reads it into one entry per id, each holding the file's one copy of the translation, before the translations cache takes them. Files of builds without the option are read as before.
