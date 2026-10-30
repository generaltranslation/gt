---
'gt-react': patch
'gt-react-native': patch
---

Native providers, caches and setup no longer touch dictionaries. `GTProvider` still accepts `dictionaries` and `onMissingDictionary*`, and `initializeGT()`/`initializeGTSPA()` still accept `dictionary` and `loadDictionary`, by forwarding them to the new compat modules. No public API change. Native modules no longer import dictionary code; the bundle win lands when `GTProvider` and `initializeGT()` stop accepting dictionaries.
