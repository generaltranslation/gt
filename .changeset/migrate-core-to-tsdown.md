---
'generaltranslation': patch
---

Migrate build tooling from Rollup to tsdown (Rolldown). No public API changes. Output filenames simplified (e.g. `index.cjs.min.cjs` → `index.cjs`), minification removed (consumers bundle with their own minifier).
