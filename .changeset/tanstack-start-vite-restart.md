---
'gt-tanstack-start': patch
---

Translations keep loading after Vite restarts its dev server. The server set GT up once per process, so after a restart it kept calling the translation loader, and the dictionary loader, of the closed module runner: locales that had not been loaded yet rendered untranslated with `Vite module runner has been closed`. The server now sets GT up again each time the Vite plugin's config module is evaluated.
