---
'gt-next': patch
---

The gt-next SWC plugin no longer treats `<GT.T>` as gt-next's `<T>` when a parameter or local variable named `GT` shadows `import * as GT from 'gt-next'`. Before, it added a `_hash` to that component, or rejected its children as unwrapped dynamic content.
