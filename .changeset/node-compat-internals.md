---
'gt-node': patch
---

`initializeGT()` forwards `dictionary` and `loadDictionary` to the gt-i18n `DictionaryManager` instead of the translation cache. No public API change.
