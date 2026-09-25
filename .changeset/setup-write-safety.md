---
'gt': patch
---

Make setup config updates replace selected locales, preserve unrelated fields, and fail instead of overwriting invalid config. Check credential-file content before changing ignore rules. Refresh generated translation loaders while preserving custom code and propagating file-write failures. Vite setup preserves app-owned bootstraps for manual review and supports default or named custom loader exports instead of generating broken imports.
