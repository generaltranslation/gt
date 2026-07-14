---
'@generaltranslation/react-core': patch
---

Remove duplicated GTProp computation in `writeChildrenAsObjects`. The result of `createGTProp()` was immediately overwritten by an inline copy of the same logic, and because both copies recursed into plural/branch subtrees, each level of `<Plural>`/`<Branch>` nesting doubled the serialization work. Branch subtrees are now serialized once.
