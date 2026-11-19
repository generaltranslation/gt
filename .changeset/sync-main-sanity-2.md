---
'gt-sanity': patch
---

From `main` (gt-sanity 4.0.36): the Translate dialog on a document has a **Retranslate** button that translates the selected locales again from scratch, even when the document has not changed (#2899). Retranslating no longer risks importing the translation it replaces when a retry follows a failed retranslation, or when one starts before the dialog has finished loading (#2901).
