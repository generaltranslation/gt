---
'@generaltranslation/compiler': minor
---

feat(compiler): add the locale twin generation engine

- Internal, bundler-agnostic `generateLocaleTwins()` turns a client build output into per-locale twins: it finds every chunk with a locale twin placeholder plus every chunk that references a twinned chunk, replaces each placeholder with that locale's content as `[locale, content]` (the source text with the source locale for the default locale and for missing translations, so it formats like a missing translation), renames static imports, dynamic imports and Vite preload lists to same-locale twins (string and template literals whose whole value is a chunk path, and runtime URL templates such as `` `${base}/assets/x.js` `` from Vite's `renderBuiltUrl`, found by tokenizing each file; chunk file and directory names may contain spaces), and versions twin file names per locale.
- Returns the twin files with composed source maps, the twin manifest, stale twins from the previous manifest to delete, and a report (twinned vs shared files, bytes per locale, output multiplier, missing translations, the entries each twinned file carries and the bytes of its inline translations per locale). The Vite build hook that runs it comes in a later release.
