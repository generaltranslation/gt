---
'gt-react': minor
---

Add what a framework that renders pages on a server starts a build with `experimentalSplitTranslations` with. `createChunkTranslationsSeed()` and `createChunkTranslationsShellSeed()` from the new `gt-react/chunk-translations/server` entry make, from what the compiler hands the framework's plugin, a locale's catalog and the client chunks a response loads, what a page hydrates with. `seedChunkTranslations()` from `gt-react/chunk-translations` starts the page's loader with it in place of the startup script of a client-rendered app, and `loadSeededTranslations()` is the `loadTranslations` of such an app. `gt-tanstack-start` uses them; an app does not call them.
