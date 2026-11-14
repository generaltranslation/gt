---
'gt': patch
---

The `gt-lock.json` merge driver keeps the `paraglide-usage-context` section that `@generaltranslation/paraglide-js` writes, instead of failing the merge. A merge keeps one side's section whole: paraglide-js then sees, by their hashes, which files the merge changed.
