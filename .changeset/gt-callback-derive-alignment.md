---
'@generaltranslation/compiler': patch
---

Fix `$_hash` injection for `gt()` callbacks with derive content: a derive call no longer shifts the injected hashes of sibling `gt()` calls (counter misalignment), and derive `$context` no longer injects an empty `$_hash` or an empty-hash `useGT()` prefetch entry, both of which broke translation lookups.
