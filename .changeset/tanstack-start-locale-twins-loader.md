---
'gt-tanstack-start': patch
---

fix(tanstack-start): keep whole-locale files out of locale twin client builds (experimental)

With `experimental.splitting: 'locale-twins'`, the translation loader that `gtTanstackStart()` from `gt-tanstack-start/experimental/plugin/vite` generates from `files.gt.output` loads locale files only on the server and in `vite dev`. Production client builds read translations from their locale twins, so they no longer emit every locale's translations as unused public chunks. Apps with a dictionary keep whole-locale loading in the browser and the translations snapshot in the page, because dictionary entries are never twinned. A custom `loadTranslations` file should return early with `if (import.meta.env.PROD && !import.meta.env.SSR) return {};` for the same result.
