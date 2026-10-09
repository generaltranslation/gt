---
'gt': patch
---

`gt init` no longer leaves a TanStack Start root route for manual setup when a comment or string mentions `getLocale` or `getTranslationsSnapshot`. Only code that binds or uses those names blocks the automatic edit.
