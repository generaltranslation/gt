---
'gt': patch
---

Fix `<T $context="...">` and `<T $id="...">` string-literal props being dropped from hashing and registration. Context-carrying `<T>` components were registered under context-less hashes that the runtime never looks up, so their file translations always missed; `gt translate` now registers them under the same context-aware hashes the runtime and compiler compute.
