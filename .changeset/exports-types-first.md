---
'gt': patch
'gtx-cli': patch
'@generaltranslation/python-extractor': patch
'@generaltranslation/vue-extractor': patch
---

List the `types` condition first in each `exports` entry so TypeScript resolves the declarations. `gt/types` now points at the declarations and modules that the build emits.
