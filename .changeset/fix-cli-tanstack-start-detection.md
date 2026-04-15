---
'gt': patch
---

Fix inline content extraction for gt-tanstack-start projects. The CLI now correctly detects gt-tanstack-start in package.json, routes it to ReactCLI, and scans imports from gt-tanstack-start for translatable content like `<T>` components.
