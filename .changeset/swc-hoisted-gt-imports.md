---
'gt-next': patch
---

The gt-next SWC plugin now hashes a `<T>` that a module renders above its `gt-next` import. Import declarations are hoisted, but the plugin only tracked an import once it reached it, so such a `<T>` got no compile-time hash and was hashed at runtime instead.
