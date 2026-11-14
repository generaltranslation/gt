---
'gt-i18n': patch
'gt-react': patch
---

gt-react's credential reading and its Vite plugin now live in gt-i18n, so gt-svelte and gt-vue can share them. `gtReact()` still exposes `GT_PROJECT_ID` to client code, and `GT_API_KEY` only while the dev server runs, and production browser code still drops an API key with a warning.

The dev server also copies `GT_PROJECT_ID` and `GT_API_KEY` from Vite's `.env` files into its own `process.env`, when the shell has not set them. Server-rendered code then has credentials in development even when Vite loads GT packages without transforming them.
