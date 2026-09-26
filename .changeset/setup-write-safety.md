---
'gt': patch
---

Make setup config updates replace selected locales, preserve unrelated fields, and fail instead of overwriting invalid config. Check credential-file content before changing ignore rules. Refresh translation loaders matching the previous config only after setup's prompts finish. Preserve custom code (including static import-path edits) and loaders of unknown ownership with manual-review guidance, recreate missing locale files on unchanged-loader reruns, and propagate file-write failures. Vite setup preserves app-owned bootstraps, including namespace imports and entries its parser cannot read, for manual review and supports default or named custom loader exports instead of generating broken imports.
