---
'gt-svelte': patch
---

`<T>` no longer accepts unknown props. A misspelled prop such as `contex="button"` is now a type error instead of being ignored.
