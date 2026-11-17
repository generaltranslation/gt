---
'gt-i18n': patch
'@generaltranslation/react-core': patch
---

The `t` from `/unstable`, and the one `useGT()` and `getGT()` return, render the precomputed messages `@generaltranslation/compiler` now emits for static templates. A call site keeps what it resolved for its locale and reuses it while its catalog entry is the same object, so a replaced or hot-reloaded translation is rendered at once.
