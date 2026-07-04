---
"generaltranslation": patch
---

Remove the v8-era backwards-compatibility shim from `generaltranslation`.

Deletes `src/backwards-compatability/` (`dataConversion`, `oldTypes`, `typeChecking`, `oldHashJsxChildren`) and its 26 re-exports from `generaltranslation/internal` — the old↔new JSX/variable-format converters, legacy type guards, and the legacy hashers. These had no consumers anywhere in the libraries; the old format they bridged is no longer produced. Safe to drop in the next major. ~477 LOC removed from the `/internal` entry.
