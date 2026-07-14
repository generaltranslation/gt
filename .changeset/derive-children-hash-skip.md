---
'@generaltranslation/compiler': patch
---

Skip compile-time hash injection for `<T>` components containing `<Derive>` children. A single injected hash pinned the runtime lookup to a hash matching none of the per-variant translations, so the rendered translation was stuck on one variant. Also stops injecting an empty `_hash` for `<T $context={derive(...)}>` and autoderive dynamic content.
