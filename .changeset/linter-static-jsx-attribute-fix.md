---
'@generaltranslation/react-core-linter': patch
---

The `static-jsx` fix keeps the braces when it rewrites the value of an attribute: `one={label}` becomes `one={<Var>{label}</Var>}`, not `one=<Var>{label}</Var>`, which `gt` read as an empty branch.
