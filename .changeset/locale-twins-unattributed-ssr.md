---
'gt-i18n': patch
'@generaltranslation/react-core': patch
---

fix: render unattributed entries in the source locale on the server with locale twins (experimental)

With `experimental.splitting: 'locale-twins'`, the browser only has translations for entries the compiler attributed to a locale twin (those with a compile-time hash). The `/experimental` `<T>`, `useGT()`/`useMessages()`, `t()`, `getGT()` and `getMessages()` render other entries (such as `<T>` with `<Derive>`) in the source locale in production builds, on the server and in the browser alike, so server HTML hydrates. This includes `t` tagged templates the compiler's macro transform left in place, whose variables are interpolated, and calls whose options are spread. `vite dev` translates them as usual.
