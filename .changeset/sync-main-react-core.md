---
'@generaltranslation/react-core': patch
---

From `main` (react-core 11.4.17): keep the `gt` function from `useGT()` (and the dictionary hooks built on the same dev hot reload queue) stable across renders in development, so effects that list it as a dependency no longer re-run after every render. Its identity still changes when a hot-reloaded translation arrives (#2554).
