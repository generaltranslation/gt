---
'gt': patch
---

Read the lockfile for the branch the files were uploaded under when collecting local edits, so `gt save-local` and `gt translate --save-local` diff against the current branch's downloaded version instead of whichever branch is listed first in a v1 `gt-lock.json`.
