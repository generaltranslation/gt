---
'gt': patch
---

`gt generate`, `gt validate`, and source extraction in `gt translate` and `gt stage` now work in a package that depends on `gt-i18n` and no other GT library, such as a Node script, a worker or an Electron main process. The CLI did not detect `gt-i18n` on its own, so it offered only the file commands and `gt generate` failed with `unknown command 'generate'`. Any other GT library in the same `package.json` still takes priority. `gt setup` stays available there.
