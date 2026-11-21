---
'gt': patch
---

`gt` no longer reads a component of your own named `Plural`, `Ordinal` or `Branch` as the General Translation component. Inside a `<T>` it is extracted as an ordinary element, as the runtime renders it. Before, its children were stored as a fallback branch and the translation was never found. A General Translation import is still recognized under an alias, and now also when its name is quoted, as in `import { 'Plural' as Plural } from 'gt-next'`.
