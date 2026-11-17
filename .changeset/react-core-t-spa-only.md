---
'@generaltranslation/react-core': major
'gt-react': major
---

`t()` from `@generaltranslation/react-core/pure` and `gt-react` now reports every call outside a client-rendered (SPA) app, not only calls made before GT has a locale: in development it throws, and in production it logs the error and renders the source with its variables. Before, in production it logged a promise to fall back and then threw "Cannot read GT runtime context", and calls after `<GTProvider>` mounted were not reported. `t` from `/unstable` reports the same error. In a server-rendered app, use `useGT()` in components, `getGT()` in loaders and server functions, or `msg()` with `m()` from `useMessages()` or `getMessages()`.
