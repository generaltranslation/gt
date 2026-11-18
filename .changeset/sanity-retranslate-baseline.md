---
'gt-sanity': patch
---

Retranslating a document no longer risks importing the translation it replaces. Retrying after a failed retranslation, or starting one before the Translate dialog has finished loading, could let auto-import bring back the old translation.
