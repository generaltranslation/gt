---
'gt': patch
---

A font or a saved local edit too large for one 4MB request is now uploaded and sent by reference, where the API rejected it. `gt save-local` no longer runs `git` to confirm an edit, so a large edit to a single-line file is saved where it was silently skipped.
