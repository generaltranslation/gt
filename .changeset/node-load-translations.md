---
'gt': patch
---

In gt-node projects, `gt init` writes a `loadTranslations.js` that runs under Node.js. The earlier loader imported JSON without an import attribute, which Node.js refuses. The new loader imports the file first, which a bundler resolves when it builds a server or an app, and reads it with `fs` when Node.js refuses the import. A loader that an earlier version generated is kept, because a bundled server can run it, and `gt init` explains how to replace it. The message now says to pass the loader to `initializeGT` and links the gt-node guide.
