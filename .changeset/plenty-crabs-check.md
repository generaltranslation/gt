---
'gt': patch
---

Add `gt status`: reports per-locale translation coverage (translated, missing, stale) from local sources and validates translated catalogs against their source ICU messages (parse errors, missing/extra/mismatched arguments). Runs fully offline; `--ci` exits non-zero when coverage drops below `--min-coverage` (default 100) or any validation error exists.
