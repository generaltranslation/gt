---
'@generaltranslation/compiler': minor
---

feat(compiler): generate locale twins in Vite builds

- With `files.gt.splitting: 'locale-twins'` (or the `splitting` plugin option), `vite build` generates locale twins after the client environment is written: it reads `[locale].json` from `files.gt.output` (relative to the working directory), writes a twin of every twinned chunk per locale, the twin manifest `gt-locale-twins.json` and the build report `gt-locale-twins-report.json` at the client output root, and logs a summary. Server environments and `vite dev` are left as they are.
- The client build gets a default `vendor` chunk (Vite 8 `codeSplitting.groups`, Vite 7 `manualChunks`) for library code, excluding library modules that import the app, so library code is not copied per locale. A user's own chunking config is kept, with a warning. Opt out with `localeTwins.vendorChunk: false`.
- Server builds can import the client manifest from `virtual:gt-locale-twins-manifest` (`export const manifest`, `null` in dev or when locale twins are off). Types: `/// <reference types="@generaltranslation/compiler/locale-twins-manifest" />`.
- Diagnostics for missing translation files, missing translations (`localeTwins.missingTranslations: 'error'` fails the build), a large output multiplier, unfilled placeholders in files served as built, `compileTimeHash: false`, a server build without the client manifest, and a dev-mode notice.
