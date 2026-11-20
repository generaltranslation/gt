---
'gt-react': patch
---

`gt-react/chunk-translations` reads the translation files of a build made with `minifyHashes` in `@generaltranslation/compiler`'s experimental `experimentalSplitTranslations` option. Such a file holds each of its translations once and, for the list of each chunk that reads some of them, runs of a place in the list, the place of its translation in the file, and how many follow on from both. The entry reads it into one entry per id, each holding the file's one copy of the translation, before the translations cache takes them. Files of builds without hash minification are read as before. The entry also exports what compiled code loads and starts with under the names a build with hash minification imports them by, such as `loadMinifiedChunk` for `loadChunk`, so such a build fails on a missing export with a `gt-react` that does not read its files.
