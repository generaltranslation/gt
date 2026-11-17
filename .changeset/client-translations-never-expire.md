---
'gt-react': patch
'gt-react-native': patch
'gt-tanstack-start': patch
---

Translations no longer expire in the browser or in a React Native app. `initializeGTSPA()`, gt-react's browser `initializeGT()` (which gt-tanstack-start uses in the browser) and gt-react-native's `initializeGT()` now ignore `cacheExpiryTime`, as gt-next's client already does, so `cacheExpiryTime` in `gt.config.json` or the `gtTanstackStart()` options applies on the server only. Servers expire and reload translations exactly as before.

This fixes apps set up with `initializeGTSPA()` rendering the untranslated source once a locale was older than the 60 second default. In gt-tanstack-start, dictionaries from `gt-tanstack-start/compat` follow the translations and no longer expire in the browser.
