---
'gt-sanity': patch
---

With `allowNonDefaultSourceLocales`, a document that stopped being its translation group's original no longer gets translations written over it or published from it:

- Importing never patches the original's own draft, even when its group records the original under the target locale too.
- Translate All leaves out an original whose language was changed to the source locale; its group still records it in its original language, so its translations could not be imported.
- Automatic import, and the reference patching and publishing after it, run only while the open document is verified as its group's original.
