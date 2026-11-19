---
'gt-react': major
'gt-react-native': major
'gt-tanstack-start': major
---

Translations no longer expire in the browser or in a React Native app. `initializeGTSPA()`, gt-react's browser `initializeGT()` (which gt-tanstack-start uses in the browser) and gt-react-native's `initializeGT()` now ignore `cacheExpiryTime`, as gt-next's client already does, so `cacheExpiryTime` in `gt.config.json` or the `gtTanstackStart()` options applies on the server only. Servers expire and reload translations exactly as before.

If you set `cacheExpiryTime` so that an open browser tab or a running React Native app loaded new translations, it no longer has that effect there: reload the page, or restart the app, to load them.

This fixes apps set up with `initializeGTSPA()` rendering the untranslated source once a locale was older than the 60 second default. In gt-tanstack-start, dictionaries from `gt-tanstack-start/compat` follow the translations and no longer expire in the browser.
