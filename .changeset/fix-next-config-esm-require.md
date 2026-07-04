---
"gt-next": patch
---

Fix `gt-next/config` crashing at import time from ESM configs (`next.config.mjs` or `"type": "module"`). Version probing and the SWC wasm path resolution used bare `require` and `__dirname`, which don't exist in the ESM build; they now go through a CJS/ESM-safe compat helper, so `withGTConfig` works and the SWC compiler plugin resolves correctly from both module formats.
