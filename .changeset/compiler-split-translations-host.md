---
'@generaltranslation/compiler': minor
'generaltranslation': patch
---

Add the `splitTranslationsHost` option, for the plugin of a framework that renders an app on a server and builds with `experimentalSplitTranslations`. It names the Vite environments a browser loads (only those are split, and every other keeps the hash at each call site), the module that compiled code imports the loader of translation files from, and a callback that is handed what the client build wrote: the loader's start state for each entry, the files each dynamic import needs, and the messages of each file. With it the build looks for no `initializeGTSPA`, and fails on a dynamic import that loads translated chunks and that it could not wrap. The compiler also exports the `SplitTranslationsHost` and `SplitTranslationsOptions` types and `isSplitTranslationsEnabled()`. An app does not set this option.
