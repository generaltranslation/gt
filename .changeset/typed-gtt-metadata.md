---
'@generaltranslation/react-core': patch
'gt-next': patch
---

Fix `<RelativeTime>` inside `<T>`: it no longer renders the raw value or throws on a `Date`, and its content now hashes the same way as the CLI, so published translations resolve. Compiler-inserted `<RelativeTime>` is also correctly marked as automatic. Internally, GT components now describe themselves with typed metadata objects instead of hyphenated strings.
