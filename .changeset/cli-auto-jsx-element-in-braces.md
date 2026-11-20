---
'gt': patch
---

With `enableAutoJsxInjection`, `gt` now treats an element or fragment written in braces, such as `{<b>Bold words</b>}`, as the child element it compiles to, as the compiler does. Before, for `<div>Lead {<b>Bold words</b>}</div>` it placed a second automatic `<T>` inside the braces, extracted `Bold words` on its own and stopped with `Found nested <GtInternalTranslateJsx> component`, and it did not wrap an expression inside such an element, or count a `Branch`, `Plural` or `Derive` in braces when deciding where the `<T>` goes. `gt` now extracts the one message the compiled app looks up, with no error. No id that a compiled app looks up changes.
