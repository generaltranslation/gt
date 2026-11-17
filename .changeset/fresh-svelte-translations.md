---
'gt-i18n': patch
'gt-svelte': patch
---

Refresh the locale configuration and translation cache when `gt-svelte` runs `initializeGT()` again, so translation loading uses the current loader after a Vite dev server restart.
