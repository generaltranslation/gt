---
'gt-i18n': patch
'gt-react': patch
---

gt-react's credential reading and its Vite plugin now live in gt-i18n, so gt-svelte and gt-vue can share them. Behaviour is unchanged: `gtReact()` still exposes `GT_PROJECT_ID` to client code, and `GT_API_KEY` only while the dev server runs, and production browser code still drops an API key with a warning.
