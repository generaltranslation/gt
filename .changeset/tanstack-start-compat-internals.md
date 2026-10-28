---
'gt-tanstack-start': patch
---

The Vite plugin now serves the app's dictionary and dictionary loader from a separate `gt-tanstack-start/internal/_compat-config` virtual module instead of `internal/_config`. Router state and `getTranslations()` read dictionaries through compat modules. No public API change. Importing only native APIs such as `T` and `useGT` no longer bundles `getTranslations()`, about 0.5 kB smaller, minified and brotlied.
