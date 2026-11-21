---
'gt': patch
---

The CLI extracts the messages that the `t` from `useGT()` or `getGT()` translates after it is passed to a function, as in `getNavLabels(t)`. It follows `t` into functions in the same file and in imported files, including through re-exports, tsconfig paths and further calls, so those messages are uploaded and translated. A `t` passed to a function the CLI cannot find, such as a method or a function from a package, or to a destructured or rest parameter, still gets a warning.
