---
'@generaltranslation/compiler': patch
---

fix: compile TanStack Start split route modules and `gt-tanstack-start` imports

- Module ids with Vite query strings that are still JS/TS source (for example `route.tsx?tsr-split=component`) are now compiled. Asset-style imports (`?raw`, `?url`, `?worker`, `?sharedworker`, `?inline`, `?import`), virtual modules, `.d.ts` files and anything under `node_modules` are skipped.
- `gt-tanstack-start` is recognized as a GT import source, so its `<T>`, `useGT`, `t()` and t`` macro usages get compile-time hashes.
