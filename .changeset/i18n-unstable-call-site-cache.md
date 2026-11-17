---
'gt-i18n': patch
---

The `t` from `/unstable` builds the message tree of a call site once. While every value in the template is a plain value or a named variable, later renders reuse the tree and only bind the values. Without a compiler, the tree's hash is also computed once per call site instead of on every render.
