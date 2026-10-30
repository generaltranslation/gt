---
'gt-i18n': patch
'@generaltranslation/react-core': patch
---

fix: render unattributed entries in the source locale on the server with locale twins

With `files.gt.splitting: 'locale-twins'`, the browser only has translations for entries the compiler attributed to a locale twin. Server rendering translated the other entries (such as `<T>` with `<Derive>`) from the whole locale, so the HTML did not match what the browser rendered and hydration failed. The compiler now marks those entries (`$_twin: 0` / `_twin: 0`) in client and server production builds, and `<T>`, `useGT()`/`useMessages()`, `t()`, `getGT()` and `getMessages()` render them in the source locale. `vite dev` translates them as usual.
