---
'gt-tanstack-start': patch
---

Apps without `localeRouting` no longer ship gt-tanstack-start's locale routing code to the browser. The Vite plugin's generated config module imports it only when `gt.config.json` enables `localeRouting`.
