---
'@generaltranslation/react-core': patch
---

A `<T>` whose props stay the same no longer prepares its children and subscribes to its translation again on every render. In a client-rendered app without a provider, the function `useGT()` returns keeps its identity between renders, so effects that depend on it no longer run after each one.
