---
'@generaltranslation/compiler': minor
---

feat(compiler): add the locale twin generation engine

- Internal, bundler-agnostic `generateLocaleTwins()` turns a client build output into per-locale twins: it finds every chunk with a locale twin placeholder plus every chunk that references a twinned chunk, fills each placeholder with that locale's translations (source text for the default locale and for missing translations), renames static imports, dynamic imports and Vite preload lists to same-locale twins, and versions twin file names per locale.
- Returns the twin files with composed source maps, the twin manifest, stale twins from the previous manifest to delete, and a report (twinned vs shared files, bytes per locale, output multiplier, missing translations). The Vite build hook that runs it comes in a later release.
