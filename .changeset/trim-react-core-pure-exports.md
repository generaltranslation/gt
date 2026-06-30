---
"@generaltranslation/react-core": patch
---

Remove three unused exports from `@generaltranslation/react-core/pure`: `isVariableObject`, `renderSkeleton`, and `reactHasUse`. None had consumers anywhere in the libraries. Trims dead code from the client-shipped `/pure` entry.
