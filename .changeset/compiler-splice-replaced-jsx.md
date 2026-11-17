---
'@generaltranslation/compiler': patch
---

With `experimentalReplaceSource`, a replaced `<T>` that is a child of a host element or a fragment is now compiled to what it renders, in place, instead of to a `Fragment` holding it: `<li><T>Save</T></li>` becomes `<li>Enregistrer</li>`, and a `<T>` with several children adds them to its parent's children. A `<T>` with a `key`, a `<T>` passed to a component, and a `<T>` with several children inside a condition still become a `Fragment`.
