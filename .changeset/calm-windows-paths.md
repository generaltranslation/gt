---
'gt': patch
---

Normalize file paths and glob patterns on Windows while preserving POSIX glob escapes. Existing Windows `gt-lock.json` paths and path-derived file IDs are migrated to portable forward slashes, and review gates, source metadata, and font globs now resolve consistently.
