---
"generaltranslation": patch
"gt-i18n": patch
"gt": patch
---

Clean up the `generaltranslation` public API surface for the next major.

Removes the unused `generaltranslation/core` subpath, stale endpoint types, duplicate `ApiError` accessors, and dead `/internal` exports. Moves `API_VERSION` to `generaltranslation/internal`, exports the derivation helpers from the public root, and points `gt-i18n` at that public entry.
