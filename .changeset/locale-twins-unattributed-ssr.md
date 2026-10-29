---
'gt-i18n': patch
'@generaltranslation/react-core': patch
---

fix: render unattributed entries in the source locale on the server with locale twins

With `files.gt.splitting: 'locale-twins'`, the browser only has translations for entries the compiler attributed to a locale twin (those with a compile-time hash). Server rendering translated the other entries (such as `<T>` with `<Derive>`) from the whole locale, so the HTML did not match what the browser rendered and hydration failed. `<T>`, `useGT()`/`useMessages()` and `t()` now render such entries in the source locale in production builds with locale twins, on the server and in the browser alike. `vite dev` translates them as usual.
