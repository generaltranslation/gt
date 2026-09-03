---
'gt-polyfills': minor
---

feat: add gt-polyfills package with unplugin for Intl polyfill injection

New package that provides `@formatjs/intl-*` polyfill injection via unplugin, supporting Vite, Rollup, webpack, esbuild, Rspack, and more.

- `import 'gt-polyfills'` loads all base Intl polyfills
- `gt-polyfills/plugin` exports an unplugin that reads locales from `gt.config.json` and injects polyfill + locale-data imports into the entry module
