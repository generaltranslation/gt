---
'gt-next': patch
---

The gt-next SWC plugin no longer hashes a `<Plural>`, `<Ordinal>` or `<Branch>` whose only content is an empty fallback (`{null}`, `{false}` or `{''}`) with a branch marker. The runtime and `gt` store no branch data for it, so the compile-time hash did not match and the translation of the enclosing `<T>` was never found.
