---
'gt-sanity': patch
---

Recreate a translation when `translation.metadata` points at a deleted document.

References in `translation.metadata` are weak, so deleting a translated
document leaves its entry behind. Importing a translation for that locale then
resolved the stale reference to nothing and threw `Cannot read properties of
undefined (reading '_id')`, surfacing as "could not be imported. This document
was not changed." on every retry, with nothing to repair the metadata. The
import now falls through to creating a fresh translated document, which
replaces the stale entry.

`findLatestDraft` is also typed `SanityDocument | undefined` to match what it
actually returns, and a missing source document now throws a readable
diagnostic instead of a `TypeError`.
