---
'gt': patch
---

Detect a package whose only GT dependency is `gt-i18n` and give it the Node CLI commands, so `gt generate` and `gt validate` work in Node scripts, Electron main processes and workers. Extraction for these packages scans `gt-i18n` imports instead of falling back to the `gt-react` parser.
