---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
---

The exported `t` renders a precomputed message in the default locale without a cache lookup, reads the locale and the enabled flag once per call, and in the browser matches the locale once per task. `initializeGTSPA()` waits for the locale's translations without copying them out of the cache.
