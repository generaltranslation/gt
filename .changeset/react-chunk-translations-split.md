---
'gt-react': minor
---

`gt-react/chunk-translations` loads the translation files of a build made with `by: 'module'` in `@generaltranslation/compiler`'s experimental `experimentalSplitTranslations` option. In such a build a file holds the messages of modules from several chunks, so a dynamic import needs several files and the entry holds several: the page's startup script requests the entry's files and the locale's map, which lists the files each import needs, and an import runs once the map and every file it lists have arrived, requesting only the files the page does not hold yet. `loadRegionChunkTranslations()` requests files by key for apps that load chunks through their own preload logic.
