---
'gt': patch
---

`gt init` now wraps a CommonJS `module.exports = …` Next.js config in `withGTConfig()`. Before, it added the `require` but left the export unwrapped, so gt-next never loaded.
