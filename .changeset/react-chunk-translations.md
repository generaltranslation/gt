---
'gt-react': minor
---

Add the `gt-react/chunk-translations` entry, which code compiled with `@generaltranslation/compiler`'s experimental `experimentalChunkTranslations` option imports. It loads the translation files such a build writes next to its chunks: the entry's file when `initializeGTSPA()` starts, and the files of a dynamic import while its chunks download. The import runs once they have arrived and their translations are in gt-react's translations cache, where `<T>`, `t` and every other API look them up as before, so no module of a chunk runs before its translations. Such a build keeps a locale's translations for good (`cacheExpiryTime: null`), since its files do not change. A file that fails to load, or takes longer than ten seconds, is reported with a warning and its messages render their source. `loadChunkTranslations()` requests the files of a chunk for apps that load chunks through their own preload logic.
