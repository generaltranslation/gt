---
'gt': patch
---

In gt-node projects, `gt init` writes a `loadTranslations.js` that reads the translation files with `fs`, so it runs under Node.js; the earlier loader imported JSON without an import attribute, which Node.js refuses. A loader that an earlier version generated is kept, because a bundled server can run it, and `gt init` explains how to replace it. The message now says to pass the loader to `initializeGT` and links the gt-node guide.
