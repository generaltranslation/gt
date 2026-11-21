---
'gt': patch
---

Resolve the current branch before reading `gt-lock.json` in `gt save-local`, so the `files.gt` template is looked up and published under the branch the files belong to. Also warn, and avoid reporting a clean success, when a locale whose recorded hash already differs cannot be compared because the server has no copy of the version in the lockfile.
